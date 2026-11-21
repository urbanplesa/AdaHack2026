import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PatientDashboard from "./PatientDashboardLovable";
import SosButton from "./SosButton";
import Shell from "../Shell";

export default async function PacientPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "PACIENT") redirect("/zdravnik");

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    include: {
      plans: { orderBy: { label: "asc" } },
      measurements: { orderBy: { recordedAt: "desc" }, take: 50, include: { plan: true } },
      medications: true,
      chatMessages: { orderBy: { createdAt: "asc" } },
      exerciseAssignments: { include: { exerciseSet: true }, orderBy: { startDate: "asc" } },
    },
  });
  if (!patient) redirect("/login");

  const libraryEntries = await prisma.libraryEntry.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  const exerciseSets = await prisma.exerciseSet.findMany({ orderBy: { id: "asc" } });

  return (
    <Shell userName={`${user.name} · pacient`}>
      <div className="mb-4 flex justify-end">
        <SosButton />
      </div>
      <PatientDashboard
        patientName={user.name}
        diagnosis={patient.diagnosis}
        dischargeDate={patient.dischargeDate?.toISOString() ?? new Date().toISOString()}
        care={{
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
        }}
        plans={patient.plans}
        measurements={patient.measurements}
        libraryEntries={libraryEntries}
        exerciseSets={exerciseSets}
        exerciseAssignments={patient.exerciseAssignments}
        medications={patient.medications}
        chatMessages={patient.chatMessages}
      />
    </Shell>
  );
}
