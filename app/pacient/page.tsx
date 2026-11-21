import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PatientDashboard from "./PatientDashboard";

export default async function PacientPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "PACIENT") redirect("/zdravnik");

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    include: {
      plans: { orderBy: { label: "asc" } },
      measurements: { orderBy: { recordedAt: "desc" }, take: 20, include: { plan: true } },
      medications: true,
      chatMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!patient) redirect("/login");

  const libraryEntries = await prisma.libraryEntry.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return (
    <PatientDashboard
      patientName={user.name}
      diagnosis={patient.diagnosis}
      dischargeDate={patient.dischargeDate.toISOString()}
      plans={patient.plans}
      measurements={patient.measurements}
      libraryEntries={libraryEntries}
      medications={patient.medications}
      chatMessages={patient.chatMessages}
    />
  );
}
