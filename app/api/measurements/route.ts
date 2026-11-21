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

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "PACIENT") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    include: { plans: true },
  });
  if (!patient) return jsonError("Ni profila pacienta", 404);

  const { type, value, note, photoUrl } = body ?? {};
  if (typeof type !== "string" || !type.trim()) return jsonError("Vrsta meritve je obvezna", 400);
  const plan = patient.plans.find((p) => p.type === type);
  if (!plan) return jsonError("Neveljavna vrsta meritve", 400);
  if (plan.type !== "SLIKA_RANE" && (typeof value !== "number" || !Number.isFinite(value))) {
    return jsonError("Vrednost meritve je obvezna", 400);
  }
  if (note != null && typeof note !== "string") return jsonError("Neveljavna opomba", 400);
  if (photoUrl != null && typeof photoUrl !== "string") return jsonError("Neveljaven photoUrl", 400);

  const measurement = await prisma.measurement.create({
    data: {
      patientId: patient.id,
      planId: plan.id,
      type: plan.type,
      value: typeof value === "number" ? value : null,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      photoUrl: typeof photoUrl === "string" && photoUrl ? photoUrl : null,
    },
  });

  // Alarm logika: primerjava z mejnimi vrednostmi plana (zgorje + spodnje meje).
  // Deduplikacija: če za ta plan že obstaja odprt alarm iste stopnje, novega ne ustvarimo.
  if (typeof value === "number" && Number.isFinite(value)) {
    const result = evaluateThresholds(plan, value);
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
            message: alertMessage(plan.label, plan.unit, value, result.severity, result.direction),
          },
        });
      }
    }
  }

  return NextResponse.json(measurement, { status: 201 });
}
