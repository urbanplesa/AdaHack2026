import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Shell from "../Shell";
import DoctorDashboardLovable from "./DoctorDashboardLovable";

const rank: Record<string, number> = { L1: 1, L2: 2, L3: 3, IZOSTANEK_VNOSA: 4, SOS: 5 };

export default async function ZdravnikPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ZDRAVNIK") redirect("/pacient");

  const patients = await prisma.patient.findMany({
    include: {
      user: true,
      plans: { orderBy: { label: "asc" } },
      measurements: { orderBy: { recordedAt: "desc" }, include: { plan: true } },
      alerts: { orderBy: { createdAt: "desc" }, include: { measurement: true } },
      medications: true,
      chatMessages: { orderBy: { createdAt: "asc" } },
      exerciseAssignments: { include: { exerciseSet: true }, orderBy: { startDate: "asc" } },
    },
  });

  const libraryEntries = await prisma.libraryEntry.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  const exerciseSets = await prisma.exerciseSet.findMany({ orderBy: { id: "asc" } });
  const standards = await prisma.standard.findMany({ orderBy: { metricType: "asc" } });

  const serialized = patients.map((patient) => {
    const openAlerts = patient.alerts.filter((alert) => alert.status === "ODPRT");
    const highest = openAlerts.reduce<(typeof openAlerts)[number] | null>(
      (current, alert) =>
        !current || (rank[alert.severity] ?? 0) > (rank[current.severity] ?? 0) ? alert : current,
      null,
    );
    const latestActivity = [
      ...patient.measurements.map((item) => item.recordedAt),
      ...patient.chatMessages.map((item) => item.createdAt),
      patient.createdAt,
    ].sort((a, b) => b.getTime() - a.getTime())[0];
    // Zadnja ocena stanja iz meritev (severity) — če jo je dal zdravnik
    const lastSeverity =
      [...patient.measurements].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
        .find((m) => m.severity)?.severity ?? null;

    return {
      id: patient.id,
      status: patient.status,
      diagnosis: patient.diagnosis,
      dischargeDate: patient.dischargeDate?.toISOString() ?? "",
      contactName: patient.contactName ?? "",
      contactPhone: patient.contactPhone ?? "",
      name: patient.user.name,
      email: patient.user.email,
      latestActivity: latestActivity.toISOString(),
      highestAlert: highest?.severity ?? null,
      lastSeverity,
      zzzs: patient.zzzs,
      sideEffects: patient.sideEffects,
      timeline: patient.timeline,
      nutrition: patient.nutrition,
      exercises: patient.exercises,
      generalRecommendations: patient.generalRecommendations,
      equipment: patient.equipment,
      warningSymptoms: patient.warningSymptoms,
      alarmYellow: patient.alarmYellow,
      alarmRed: patient.alarmRed,
      catalogSource: patient.catalogSource,
      careCustomized: patient.careCustomized,
      plans: patient.plans.map((plan) => ({
        id: plan.id,
        type: plan.type,
        label: plan.label,
        unit: plan.unit,
        kind: plan.kind,
        frequency: plan.frequency,
        thresholdL1: plan.thresholdL1,
        thresholdL2: plan.thresholdL2,
        thresholdL3: plan.thresholdL3,
        thresholdLowL1: plan.thresholdLowL1,
        thresholdLowL2: plan.thresholdLowL2,
        thresholdLowL3: plan.thresholdLowL3,
        baseline: plan.baseline,
        baselineDate: plan.baselineDate?.toISOString() ?? null,
        customized: plan.customized,
        greenZone: plan.greenZone,
        yellowZone: plan.yellowZone,
        redZone: plan.redZone,
      })),
      measurements: patient.measurements.map((item) => ({
        id: item.id,
        type: item.type,
        value: item.value,
        valueText: item.valueText,
        note: item.note,
        photoUrl: item.photoUrl,
        author: item.author,
        severity: item.severity,
        recordedAt: item.recordedAt.toISOString(),
      })),
      alerts: patient.alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        status: alert.status,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        measurementType: alert.measurement?.type ?? null,
      })),
      medications: patient.medications.map((item) => ({
        id: item.id,
        name: item.name,
        dosage: item.dosage,
        times: item.times,
        duration: item.duration,
        note: item.note,
        takenSlots: item.takenSlots,
      })),
      chatMessages: patient.chatMessages.map((item) => ({
        id: item.id,
        sender: item.sender,
        text: item.text,
        createdAt: item.createdAt.toISOString(),
      })),
      exerciseAssignments: patient.exerciseAssignments.map((a) => ({
        id: a.id,
        exerciseSetId: a.exerciseSetId,
        startDate: a.startDate,
        acknowledgedDate: a.acknowledgedDate,
        exerciseSet: a.exerciseSet,
      })),
    };
  });

  return (
    <Shell userName={`${user.name} · zdravnik`}>
      <DoctorDashboardLovable
        patients={serialized}
        userName={user.name}
        libraryEntries={libraryEntries}
        exerciseSets={exerciseSets}
        standards={standards}
      />
    </Shell>
  );
}
