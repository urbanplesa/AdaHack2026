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
    },
  });

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
      plans: patient.plans.map((plan) => ({
        id: plan.id,
        type: plan.type,
        label: plan.label,
        unit: plan.unit,
        frequency: plan.frequency,
      })),
      measurements: patient.measurements.map((item) => ({
        id: item.id,
        type: item.type,
        value: item.value,
        note: item.note,
        photoUrl: item.photoUrl,
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
        takenSlots: item.takenSlots,
      })),
      chatMessages: patient.chatMessages.map((item) => ({
        id: item.id,
        sender: item.sender,
        text: item.text,
        createdAt: item.createdAt.toISOString(),
      })),
      zzzs: patient.zzzs,
      sideEffects: patient.sideEffects,
      timeline: patient.timeline,
      nutrition: patient.nutrition,
      exercises: patient.exercises,
    };
  });

  return (
    <Shell userName={`${user.name} · zdravnik`}>
      <DoctorDashboardLovable patients={serialized} userName={user.name} />
    </Shell>
  );
}
