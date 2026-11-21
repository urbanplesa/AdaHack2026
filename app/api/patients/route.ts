import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PATIENT_PASSWORD, getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

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

// POST — ustvari novega pacienta skupaj z merilnimi načrti in zdravili (samo ZDRAVNIK)
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

  const optString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const optNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const metrics = Array.isArray(body.metrics) ? body.metrics : [];
  const medications = Array.isArray(body.medications) ? body.medications : [];

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
        contactName: optString(body.contactName) ?? "Ni vpisano",
        contactPhone: optString(body.contactPhone) ?? "Ni vpisano",
        zzzs: optString(body.zzzs),
        sideEffects: optString(body.sideEffects),
        timeline: optString(body.timeline),
        nutrition: optString(body.nutrition),
        exercises: optString(body.exercises),
      },
    });

    for (const metric of metrics) {
      if (!metric?.type) continue;
      await tx.measurementPlan.create({
        data: {
          patientId: patient.id,
          type: String(metric.type),
          label: metric.label || metric.type,
          unit: metric.unit || "",
          frequency: metric.frequency || "Po navodilu",
          thresholdL1: optNumber(metric.thresholdL1),
          thresholdL2: optNumber(metric.thresholdL2),
          thresholdL3: optNumber(metric.thresholdL3),
          thresholdLowL1: optNumber(metric.thresholdLowL1),
          thresholdLowL2: optNumber(metric.thresholdLowL2),
          thresholdLowL3: optNumber(metric.thresholdLowL3),
          baseline: optString(metric.baseline),
          baselineDate:
            typeof metric.baselineDate === "string" && metric.baselineDate
              ? new Date(`${metric.baselineDate}T12:00:00`)
              : null,
          customized: Boolean(metric.customized),
          greenZone: optString(metric.greenZone),
          yellowZone: optString(metric.yellowZone),
          redZone: optString(metric.redZone),
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

    return { patientId: patient.id, email, password };
  });

  return NextResponse.json({ ok: true, ...created }, { status: 201 });
}
