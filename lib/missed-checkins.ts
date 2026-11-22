import { prisma } from "@/lib/prisma";

// Pregled izostalih vnosov meritev: za vsakega AKTIVNEGA pacienta brez vnosa
// v zadnjih MAX_HOURS_WITHOUT_INPUT urah ustvari alarm IZOSTANEK_VNOSA
// (če za pacienta še ni odprtega istega alarma). Kliče se samodejno iz
// instrumentation.ts (vsakih MISSED_CHECKINS_INTERVAL_MINUTES minut) in ročno
// prek POST /api/cron/missed-checkins.
export const MAX_HOURS_WITHOUT_INPUT = 24;

export interface MissedCheckinsResult {
  checked: number;
  createdAlerts: number;
  patientIds: string[];
}

export async function checkMissedCheckins(now: Date = new Date()): Promise<MissedCheckinsResult> {
  const cutoff = new Date(now.getTime() - MAX_HOURS_WITHOUT_INPUT * 60 * 60 * 1000);
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
          ? `Pacient ${patient.user.name} ni vnesel meritev že ${Math.round((now.getTime() - last.getTime()) / 3600000)} h — najprej kontaktna oseba, nato zdravnik`
          : `Pacient ${patient.user.name} še ni nikoli vnesel meritve — preverite kontaktno osebo`,
      },
    });
    created.push(patient.id);
  }

  return { checked: patients.length, createdAlerts: created.length, patientIds: created };
}
