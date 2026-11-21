import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

// GET — zdravnik vidi vse alarme (z imenom pacienta); pacient samo svoje
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  if (user.role === "ZDRAVNIK") {
    const alerts = await prisma.alert.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { patient: { include: { user: true } }, measurement: true },
    });
    return NextResponse.json(
      alerts.map((a) => ({
        ...a,
        patientName: a.patient.user.name,
      })),
    );
  }

  if (user.role === "PACIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) return jsonError("Ni profila pacienta", 404);
    const alerts = await prisma.alert.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
      include: { measurement: true },
    });
    return NextResponse.json(alerts);
  }

  return jsonError("Ni dovoljenja", 403);
}

// POST — { action: "sos" } (pacient) | { action: "acknowledge", alertId } (zdravnik)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  if (body.action === "sos") {
    if (user.role !== "PACIENT") return jsonError("Ni dovoljenja", 403);
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) return jsonError("Ni profila pacienta", 404);
    const alert = await prisma.alert.create({
      data: {
        patientId: patient.id,
        severity: "SOS",
        status: "ODPRT",
        message: `Pacient ${user.name} je pritisnil SOS — takojšnja intervencija (klic na 112)`,
      },
    });
    return NextResponse.json(alert, { status: 201 });
  }

  if (body.action === "acknowledge") {
    if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);
    const alert = await prisma.alert.findUnique({ where: { id: body.alertId } });
    if (!alert) return jsonError("Alarm ni najden", 404);
    if (alert.status !== "ODPRT") return jsonError("Alarm je že potrjen", 409);
    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "POTRJEN", acknowledgedAt: new Date(), acknowledgedBy: user.id },
    });
    return NextResponse.json(updated);
  }

  return jsonError("Neznana akcija", 400);
}
