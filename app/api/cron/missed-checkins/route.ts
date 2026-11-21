import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

// POST — preveri paciente brez vnosa meritev v zadnjih 24 urah in ustvari
// alarm IZOSTANEK_VNOSA (če za pacienta še ni odprtega istega alarma).
// Zaščita: severn skrivnost (x-cron-secret) ALI seja zdravnika (za ročni demo klic).
const MAX_HOURS_WITHOUT_INPUT = 24;

export async function POST(req: NextRequest) {
  const secretOk =
    !!process.env.CRON_SECRET && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  const user = await getSessionUser();
  if (!secretOk && (!user || user.role !== "ZDRAVNIK")) {
    return jsonError("Ni dovoljenja", 403);
  }

  const cutoff = new Date(Date.now() - MAX_HOURS_WITHOUT_INPUT * 60 * 60 * 1000);
  const patients = await prisma.patient.findMany({
    where: { status: "AKTIVEN" },
    include: {
      user: true,
      measurements: { orderBy: { recordedAt: "desc" }, take: 1 },
      alerts: { where: { severity: "IZOSTANEK_VNOSA", status: "ODPRT" } },
    },
  });

  const created: string[] = [];
  for (const patient of patients) {
    const last = patient.measurements[0]?.recordedAt ?? null;
    if (last && last > cutoff) continue;
    if (patient.alerts.length > 0) continue; // že ima odprt alarm za izostanek
    await prisma.alert.create({
      data: {
        patientId: patient.id,
        severity: "IZOSTANEK_VNOSA",
        status: "ODPRT",
        message: last
          ? `Pacient ${patient.user.name} ni vnesel meritev že ${Math.round((Date.now() - last.getTime()) / 3600000)} h — najprej kontaktna oseba, nato zdravnik`
          : `Pacient ${patient.user.name} še ni nikoli vnesel meritve — preverite kontaktno osebo`,
      },
    });
    created.push(patient.id);
  }

  return NextResponse.json({ checked: patients.length, createdAlerts: created.length, patientIds: created });
}
