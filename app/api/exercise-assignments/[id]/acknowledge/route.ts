import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { localDateKey } from "@/lib/catalog";

// POST — pacient potrdi prejem opomnika za sklop vaj (acknowledgedDate = danes)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "PACIENT") return jsonError("Ni dovoljenja", 403);

  const { id } = await params;
  const assignment = await prisma.patientExerciseSet.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!assignment) return jsonError("Dodelitev ne obstaja", 404);
  if (assignment.patient.userId !== user.id) return jsonError("Ni dovoljenja", 403);

  const updated = await prisma.patientExerciseSet.update({
    where: { id },
    data: { acknowledgedDate: localDateKey(new Date()) },
    include: { exerciseSet: true },
  });
  return NextResponse.json(updated);
}
