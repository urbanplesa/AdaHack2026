import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PATIENT_PASSWORD, getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { autoExerciseStartDate, equipmentForTypes, findCatalogCondition } from "@/lib/catalog";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Spoji sezname opreme brez podvajanj (ločeno z vejico, neobčutljivo na velikost črk)
function mergeEquipment(...values: (string | null | undefined)[]): string | null {
  const parts = values
    .flatMap((v) => (v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLocaleLowerCase("sl");
    if (!seen.has(key)) { seen.add(key); out.push(p); }
  }
  return out.length ? out.join(", ") : null;
}

// GET — seznam pacientov (samo ZDRAVNIK)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true, alerts: { where: { status: "ODPRT" } } },
  });
  return NextResponse.json(
    patients.map((p) => ({
      id: p.id,
      name: p.user.name,
      email: p.user.email,
      status: p.status,
      diagnosis: p.diagnosis,
      openAlerts: p.alerts.length,
    })),
  );
}

// POST — ustvari novega pacienta skupaj z merilnimi načrti in zdravili (samo ZDRAVNIK).
// Če diagnoza sovpada s stanjem iz kataloga (lib/catalog), se načrti, priporočila
// in sklopi vaj nastavijo samodejno iz kataloga.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const diagnosis = typeof body.diagnosis === "string" ? body.diagnosis.trim() : "";
  if (!name || !diagnosis) return jsonError("Ime in diagnoza sta obvezna", 400);

  const suppliedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const email = suppliedEmail || `pacient-${randomUUID().slice(0, 8)}@test.si`;
  if (await prisma.user.findUnique({ where: { email } })) {
    return jsonError("Uporabnik s to e-pošto že obstaja", 409);
  }

  // Vsi pacienti imajo isto privzeto geslo (hackathon demo)
  const password = DEFAULT_PATIENT_PASSWORD;
  const dischargeDate =
    typeof body.dischargeDate === "string" && body.dischargeDate
      ? new Date(`${body.dischargeDate}T12:00:00`)
      : new Date();
  const dischargeDateStr = dischargeDate.toISOString().slice(0, 10);

  const optString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const optNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  // Katalog stanj: če diagnoza sovpada, načrti/priporočila/vaje pridejo iz kataloga
  const catalog = findCatalogCondition(diagnosis);
  const manualMetrics = Array.isArray(body.metrics) ? body.metrics : [];
  const medications = Array.isArray(body.medications) ? body.medications : [];

  // Načrti: iz kataloga + ročno dodani (če še niso v katalogu)
  type PlanInput = {
    type: string; label: string; unit: string; kind: string; frequency: string;
    thresholdL1?: number | null; thresholdL2?: number | null; thresholdL3?: number | null;
    thresholdLowL1?: number | null; thresholdLowL2?: number | null; thresholdLowL3?: number | null;
    baseline?: string | null; baselineDate?: string | null;
    customized?: boolean; greenZone?: string | null; yellowZone?: string | null; redZone?: string | null;
  };
  const plans: PlanInput[] = catalog
    ? catalog.plans.map((p) => ({
        type: p.type, label: p.label, unit: p.unit, kind: p.kind, frequency: p.frequency,
        thresholdL2: p.thresholdL2, thresholdL3: p.thresholdL3,
        thresholdLowL2: p.thresholdLowL2, thresholdLowL3: p.thresholdLowL3,
        yellowZone: p.yellowZone || null, redZone: p.redZone || null,
      }))
    : [];
  for (const metric of manualMetrics) {
    if (!metric?.type || plans.some((p) => p.type === metric.type)) continue;
    plans.push({
      type: String(metric.type),
      label: metric.label || String(metric.type),
      unit: metric.unit || "",
      kind: metric.kind || "NUMERIC",
      frequency: metric.frequency || "Po navodilu",
      thresholdL1: optNumber(metric.thresholdL1),
      thresholdL2: optNumber(metric.thresholdL2),
      thresholdL3: optNumber(metric.thresholdL3),
      thresholdLowL1: optNumber(metric.thresholdLowL1),
      thresholdLowL2: optNumber(metric.thresholdLowL2),
      thresholdLowL3: optNumber(metric.thresholdLowL3),
      baseline: optString(metric.baseline),
      baselineDate: typeof metric.baselineDate === "string" && metric.baselineDate ? metric.baselineDate : null,
      customized: Boolean(metric.customized),
      greenZone: optString(metric.greenZone),
      yellowZone: optString(metric.yellowZone),
      redZone: optString(metric.redZone),
    });
  }
  // Če katalog nima alarmov za tip, uporabimo standardne meje bolnice (če obstajajo)
  const standardList = await prisma.standard.findMany();
  for (const plan of plans) {
    const std = standardList.find((s) => s.metricType === plan.type);
    if (!std) continue;
    if (plan.thresholdL2 == null && plan.thresholdLowL2 == null) {
      plan.thresholdL2 = std.thresholdL2;
      plan.thresholdLowL2 = std.thresholdLowL2;
    }
    if (plan.thresholdL3 == null && plan.thresholdLowL3 == null) {
      plan.thresholdL3 = std.thresholdL3;
      plan.thresholdLowL3 = std.thresholdLowL3;
    }
    if (!plan.yellowZone && std.yellowZone) plan.yellowZone = std.yellowZone;
    if (!plan.redZone && std.redZone) plan.redZone = std.redZone;
    if (!plan.greenZone && std.greenZone) plan.greenZone = std.greenZone;
    if (!plan.thresholdL1 && std.thresholdL1) plan.thresholdL1 = std.thresholdL1;
    if (!plan.thresholdLowL1 && std.thresholdLowL1) plan.thresholdLowL1 = std.thresholdLowL1;
  }

  const created = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { email, password, name, role: "PACIENT" },
    });
    const patient = await tx.patient.create({
      data: {
        user: { connect: { id: createdUser.id } },
        status: "AKTIVEN",
        diagnosis,
        dischargeDate,
        procedureDate: dischargeDate,
        contactName: optString(body.contactName) ?? "Ni vpisano",
        contactPhone: optString(body.contactPhone) ?? "Ni vpisano",
        zzzs: optString(body.zzzs),
        sideEffects: optString(body.sideEffects) ?? catalog?.sideEffects ?? null,
        timeline: optString(body.timeline) ?? catalog?.timeline ?? null,
        nutrition: optString(body.nutrition) ?? catalog?.nutrition ?? null,
        exercises: optString(body.exercises),
        generalRecommendations: optString(body.generalRecommendations) ?? catalog?.recommendations ?? null,
        equipment:
          optString(body.equipment) ??
          (catalog ? mergeEquipment(catalog.equipment, equipmentForTypes(plans.map((p) => p.type))) : null),
        warningSymptoms: optString(body.warningSymptoms) ?? catalog?.warningSymptoms ?? null,
        alarmYellow: optString(body.alarmYellow) ?? catalog?.alarmYellow ?? null,
        alarmRed: optString(body.alarmRed) ?? catalog?.alarmRed ?? null,
        catalogSource: catalog?.source ?? null,
        careCustomized: Boolean(body.careCustomized),
      },
    });

    for (const plan of plans) {
      await tx.measurementPlan.create({
        data: {
          patientId: patient.id,
          type: plan.type,
          label: plan.label,
          unit: plan.unit,
          kind: plan.kind,
          frequency: plan.frequency,
          thresholdL1: optNumber(plan.thresholdL1),
          thresholdL2: optNumber(plan.thresholdL2),
          thresholdL3: optNumber(plan.thresholdL3),
          thresholdLowL1: optNumber(plan.thresholdLowL1),
          thresholdLowL2: optNumber(plan.thresholdLowL2),
          thresholdLowL3: optNumber(plan.thresholdLowL3),
          baseline: optString(plan.baseline),
          baselineDate:
            typeof plan.baselineDate === "string" && plan.baselineDate
              ? new Date(`${plan.baselineDate}T12:00:00`)
              : null,
          customized: Boolean(plan.customized),
          greenZone: optString(plan.greenZone),
          yellowZone: optString(plan.yellowZone),
          redZone: optString(plan.redZone),
        },
      });
    }

    for (const medication of medications) {
      if (!medication?.name) continue;
      await tx.medication.create({
        data: {
          patientId: patient.id,
          name: String(medication.name).trim(),
          dosage: String(medication.dosage || "").trim(),
          times: JSON.stringify(Array.isArray(medication.times) ? medication.times : []),
          duration: optString(medication.duration),
          note: optString(medication.note),
        },
      });
    }

    // Sklopi vaj: če je v zahtevku eksplicitni seznam exerciseSets (iz obrazca — lahko tudi prazen),
    // se dodeli natanko ta izbira; sicer privzeto vsi sklopi iz kataloga.
    // Manjkajoč/neveljaven startDate se izračuna iz kataloga (Začetek vaj + datum odpusta).
    const exerciseAssignments: string[] = [];
    const explicitExercises = Array.isArray(body.exerciseSets)
      ? (body.exerciseSets as { exerciseSetId?: unknown; startDate?: unknown }[])
      : null;
    const seenSets = new Set<string>();
    const exerciseEntries: { setId: string; startDate: string }[] = explicitExercises
      ? explicitExercises
          .map((e) => ({
            setId: typeof e?.exerciseSetId === "string" ? e.exerciseSetId : "",
            startDate: typeof e?.startDate === "string" ? e.startDate : "",
          }))
          .filter((e) => e.setId && !seenSets.has(e.setId) && (seenSets.add(e.setId), true))
      : catalog
        ? catalog.exerciseSetIds.map((setId) => ({ setId, startDate: "" }))
        : [];
    for (const entry of exerciseEntries) {
      const set = await tx.exerciseSet.findUnique({ where: { id: entry.setId } });
      if (!set) continue;
      const startDate = DATE_RE.test(entry.startDate)
        ? entry.startDate
        : autoExerciseStartDate(catalog?.startGuidance ?? "", dischargeDateStr) || dischargeDateStr;
      await tx.patientExerciseSet.create({
        data: { patientId: patient.id, exerciseSetId: entry.setId, startDate },
      });
      exerciseAssignments.push(entry.setId);
    }

    return { patientId: patient.id, email, password, exerciseAssignments };
  });

  return NextResponse.json({ ok: true, catalogApplied: Boolean(catalog), ...created }, { status: 201 });
}
