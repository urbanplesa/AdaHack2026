import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Ni prijave" }, { status: 401 });
  }

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
  if (!user || user.role !== "PACIENT") {
    return NextResponse.json({ error: "Ni dovoljenja" }, { status: 403 });
  }

  const body = await req.json();

  if (body.action === "chat") {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) return NextResponse.json({ error: "Ni profila pacienta" }, { status: 404 });
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Sporočilo je obvezno" }, { status: 400 });
    }
    const message = await prisma.chatMessage.create({
      data: { patientId: patient.id, sender: "PACIENT", text: body.text.trim() },
    });
    return NextResponse.json(message, { status: 201 });
  }

  if (body.action === "medication") {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) return NextResponse.json({ error: "Ni profila pacienta" }, { status: 404 });
    const medication = await prisma.medication.findFirst({
      where: { id: body.medicationId, patientId: patient.id },
    });
    if (!medication) return NextResponse.json({ error: "Zdravilo ni najdeno" }, { status: 404 });
    const today = new Date().toDateString();
    const takenToday = medication.takenAt && new Date(medication.takenAt).toDateString() === today;
    const updated = await prisma.medication.update({
      where: { id: medication.id },
      data: { takenAt: takenToday ? null : new Date() },
    });
    return NextResponse.json(updated);
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    include: { plans: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Ni profila pacienta" }, { status: 404 });
  }

  const { type, value, note, photoUrl } = body;
  const plan = patient.plans.find((p) => p.type === type);
  if (!plan) {
    return NextResponse.json({ error: "Neveljavna vrsta meritve" }, { status: 400 });
  }
  if (plan.type !== "SLIKA_RANE") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return NextResponse.json({ error: "Vrednost meritve je obvezna" }, { status: 400 });
    }
  }

  const measurement = await prisma.measurement.create({
    data: {
      patientId: patient.id,
      planId: plan?.id ?? null,
      type,
      value: value ?? null,
      note: note ?? null,
      photoUrl: photoUrl ?? null,
    },
  });

  // Alarm logika: primerjava z mejnimi vrednostmi plana
  if (plan && value != null) {
    let severity: string | null = null;
    if (plan.thresholdL3 != null && value >= plan.thresholdL3) severity = "L3";
    else if (plan.thresholdL2 != null && value >= plan.thresholdL2) severity = "L2";
    else if (plan.thresholdL1 != null && value >= plan.thresholdL1) severity = "L1";

    if (severity) {
      await prisma.alert.create({
        data: {
          patientId: patient.id,
          measurementId: measurement.id,
          severity,
          message: `Meritev ${plan.label} = ${value} ${plan.unit} presega mejo ${severity}`,
        },
      });
    }
  }

  return NextResponse.json(measurement, { status: 201 });
}
