import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

// DELETE — odstrani sklop vaj (samo ZDRAVNIK); dodelitve se odstranijo skupaj
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const { id } = await params;
  const existing = await prisma.exerciseSet.findUnique({ where: { id } });
  if (!existing) return jsonError("Sklop ne obstaja", 404);

  await prisma.patientExerciseSet.deleteMany({ where: { exerciseSetId: id } });
  await prisma.exerciseSet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
