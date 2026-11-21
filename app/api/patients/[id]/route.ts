import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { autoExerciseStartDate, findCatalogCondition } from "@/lib/catalog";

// PATCH — posodobi pacienta (samo ZDRAVNIK): osnovni podatki, diagnoza, načrti
// (baseline/meje/customized), dodajanje zdravil, dodeljevanje sklopov vaj.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const { id } = await params;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) return jsonError("Pacient ne obstaja", 404);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  const optString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const optNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  // Če se diagnoza spremeni in je v katalogu → priporočila iz kataloga (če niso eksplicitno podana)
  const catalog =
    typeof body.diagnosis === "string" && body.diagnosis.trim()
      ? findCatalogCondition(body.diagnosis)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    for (const key of [
      "status", "contactName", "contactPhone", "zzzs", "sideEffects", "timeline", "nutrition",
      "exercises", "generalRecommendations", "equipment", "warningSymptoms", "alarmYellow", "alarmRed",
    ] as const) {
      if (body[key] !== undefined) data[key] = optString(body[key]);
    }
    if (typeof body.diagnosis === "string" && body.diagnosis.trim()) {
      data.diagnosis = body.diagnosis.trim();
      if (catalog) {
        if (body.sideEffects === undefined) data.sideEffects = catalog.sideEffects;
        if (body.timeline === undefined) data.timeline = catalog.timeline;
        if (body.nutrition === undefined) data.nutrition = catalog.nutrition;
        if (body.generalRecommendations === undefined) data.generalRecommendations = catalog.recommendations;
        if (body.warningSymptoms === undefined) data.warningSymptoms = catalog.warningSymptoms;
        if (body.alarmYellow === undefined) data.alarmYellow = catalog.alarmYellow;
        if (body.alarmRed === undefined) data.alarmRed = catalog.alarmRed;
        data.catalogSource = catalog.source;
      }
    }
    if (body.careCustomized !== undefined) data.careCustomized = Boolean(body.careCustomized);
    if (typeof body.dischargeDate === "string" && body.dischargeDate) {
      data.dischargeDate = new Date(`${body.dischargeDate}T12:00:00`);
      data.procedureDate = data.dischargeDate;
    }

    const updatedPatient = await tx.patient.update({ where: { id }, data });

    // Načrti: posodobi obstoječe (po id), ustvari nove, zbriši odstranjene
    if (Array.isArray(body.plans)) {
      const existing = await tx.measurementPlan.findMany({ where: { patientId: id } });
      const keepIds = new Set<string>();
      for (const plan of body.plans) {
        if (!plan || typeof plan !== "object") continue;
        const planData = {
          type: String(plan.type || ""),
          label: String(plan.label || plan.type || ""),
          unit: typeof plan.unit === "string" ? plan.unit : "",
          kind: typeof plan.kind === "string" ? plan.kind : "NUMERIC",
          frequency: typeof plan.frequency === "string" ? plan.frequency : "Po navodilu",
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
        };
        if (typeof plan.id === "string" && existing.some((p) => p.id === plan.id)) {
          await tx.measurementPlan.update({ where: { id: plan.id }, data: planData });
          keepIds.add(plan.id);
        } else if (plan.type) {
          const created = await tx.measurementPlan.create({
            data: { ...planData, patientId: id },
          });
          keepIds.add(created.id);
        }
      }
      const toDelete = existing.filter((p) => !keepIds.has(p.id)).map((p) => p.id);
      if (toDelete.length) {
        await tx.measurement.deleteMany({ where: { planId: { in: toDelete } } });
        await tx.measurementPlan.deleteMany({ where: { id: { in: toDelete } } });
      }
    }

    // Zdravila: samo dodajanje novih (brisanje prek obstoječega toka)
    if (Array.isArray(body.medications)) {
      for (const med of body.medications) {
        if (!med?.name) continue;
        await tx.medication.create({
          data: {
            patientId: id,
            name: String(med.name).trim(),
            dosage: String(med.dosage || "").trim(),
            times: JSON.stringify(Array.isArray(med.times) ? med.times : []),
            duration: optString(med.duration),
            note: optString(med.note),
          },
        });
      }
    }

    // Sklopi vaj: sinhroniziraj dodelitve (če so podane)
    if (Array.isArray(body.exerciseAssignments)) {
      const existingAssignments = await tx.patientExerciseSet.findMany({ where: { patientId: id } });
      const keep = new Set<string>();
      const procedureDateStr = updatedPatient.procedureDate
        ? updatedPatient.procedureDate.toISOString().slice(0, 10)
        : null;
      for (const a of body.exerciseAssignments) {
        if (!a?.exerciseSetId) continue;
        const set = await tx.exerciseSet.findUnique({ where: { id: String(a.exerciseSetId) } });
        if (!set) continue;
        let startDate = typeof a.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.startDate)
          ? a.startDate
          : "";
        if (!startDate && catalog) {
          startDate = autoExerciseStartDate(catalog.startGuidance, procedureDateStr);
        }
        if (!startDate) continue;
        await tx.patientExerciseSet.upsert({
          where: { patientId_exerciseSetId: { patientId: id, exerciseSetId: set.id } },
          create: { patientId: id, exerciseSetId: set.id, startDate },
          update: { startDate },
        });
        keep.add(set.id);
      }
      const toRemove = existingAssignments.filter((a) => !keep.has(a.exerciseSetId)).map((a) => a.id);
      if (toRemove.length) await tx.patientExerciseSet.deleteMany({ where: { id: { in: toRemove } } });
    }

    return updatedPatient;
  });

  return NextResponse.json({ ok: true, patient: updated });
}
