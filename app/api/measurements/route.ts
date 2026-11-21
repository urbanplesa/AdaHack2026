import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { alertMessage, evaluateThresholds } from "@/lib/thresholds";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  const patientId = req.nextUrl.searchParams.get("patientId");
  const where =
    user.role === "ZDRAVNIK" && patientId
      ? { patientId }
      : { patient: { userId: user.id } };

  const measurements = await prisma.measurement.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    include: { plan: true },
  });
  return NextResponse.json(measurements);
}

// POST — nov vnos meritve.
// PACIENT: vnaša svoje meritve (value glede na kind plana; valueText za TEXT/PRESSURE/YESNO; photoUrl za IMAGE).
// ZDRAVNIK: lahko vnaša meritev za izbranega pacienta (patientId) z oceno severity (VARNO|NENAVADNO|KRITICNO).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  const isDoctor = user.role === "ZDRAVNIK";
  const patientId =
    isDoctor && typeof body.patientId === "string"
      ? body.patientId
      : undefined;

  const patient = patientId
    ? await prisma.patient.findUnique({ where: { id: patientId }, include: { plans: true } })
    : await prisma.patient.findUnique({
        where: { userId: user.id },
        include: { plans: true },
      });
  if (!patient) return jsonError("Ni profila pacienta", 404);
  if (!isDoctor && patient.userId !== user.id) return jsonError("Ni dovoljenja", 403);

  const { type, note, photoUrl } = body ?? {};
  if (typeof type !== "string" || !type.trim()) return jsonError("Vrsta meritve je obvezna", 400);
  const plan = patient.plans.find((p) => p.type === type);
  if (!plan) return jsonError("Neveljavna vrsta meritve", 400);

  const kind = plan.kind || "NUMERIC";
  const value = typeof body.value === "number" && Number.isFinite(body.value) ? body.value : null;
  const valueText = typeof body.valueText === "string" && body.valueText.trim() ? body.valueText.trim() : null;

  // PRITISK: sprejmi "120/80" (valueText) — numerična vrednost za alarm je sistolični
  let numericValue = value;
  if (kind === "PRESSURE" && valueText) {
    const sys = Number(valueText.split("/")[0]);
    if (Number.isFinite(sys)) numericValue = sys;
  }

  if (kind === "NUMERIC" && numericValue === null) return jsonError("Vrednost meritve je obvezna", 400);
  if (kind === "TEXT" && !valueText) return jsonError("Vrednost meritve je obvezna", 400);
  if (kind === "PRESSURE" && !valueText) return jsonError("Vnesite pritisk (npr. 120/80)", 400);
  if (kind === "YESNO" && valueText !== "Ja" && valueText !== "Ne") return jsonError("Izberite Ja ali Ne", 400);
  if (kind === "IMAGE" && !photoUrl) return jsonError("Priložite sliko", 400);
  if (note != null && typeof note !== "string") return jsonError("Neveljavna opomba", 400);
  if (photoUrl != null && typeof photoUrl !== "string") return jsonError("Neveljaven photoUrl", 400);

  const severity =
    isDoctor && typeof body.severity === "string" && ["VARNO", "NENAVADNO", "KRITICNO"].includes(body.severity)
      ? body.severity
      : kind === "IMAGE" || !numericValue
        ? null
        : "NEOCENJENO";

  const measurement = await prisma.measurement.create({
    data: {
      patientId: patient.id,
      planId: plan.id,
      type: plan.type,
      value: numericValue,
      valueText,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      photoUrl: typeof photoUrl === "string" && photoUrl ? photoUrl : null,
      author: isDoctor ? "ZDRAVNIK" : "PACIENT",
      severity,
    },
  });

  // Alarm logika: primerjava z mejnimi vrednostmi plana (zgorje + spodnje meje).
  // Deduplikacija: če za ta plan že obstaja odprt alarm iste stopnje, novega ne ustvarimo.
  if (numericValue !== null) {
    const result = evaluateThresholds(plan, numericValue);
    if (result) {
      const existing = await prisma.alert.findFirst({
        where: {
          patientId: patient.id,
          status: "ODPRT",
          severity: result.severity,
          measurement: { planId: plan.id },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            patientId: patient.id,
            measurementId: measurement.id,
            severity: result.severity,
            message: alertMessage(plan.label, plan.unit, numericValue, result.severity, result.direction),
          },
        });
      }
    }
  }

  return NextResponse.json(measurement, { status: 201 });
}
