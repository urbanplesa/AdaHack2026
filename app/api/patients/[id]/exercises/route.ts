import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getPatientOrRes(id: string, user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return { res: jsonError("Ni prijave", 401) as NextResponse } as const;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) return { res: jsonError("Pacient ne obstaja", 404) as NextResponse } as const;
  const allowed = user.role === "ZDRAVNIK" || (user.role === "PACIENT" && patient.userId === user.id);
  if (!allowed) return { res: jsonError("Ni dovoljenja", 403) as NextResponse } as const;
  return { patient } as const;
}

// GET — dodeljeni sklopi vaj pacienta (s podatki sklopa)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  const got = await getPatientOrRes(id, user);
  if ("res" in got) return got.res;

  const assignments = await prisma.patientExerciseSet.findMany({
    where: { patientId: got.patient.id },
    include: { exerciseSet: true },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(assignments);
}

// POST — dodeli sklop vaji pacientu (upsert) s startnim datumom; samo ZDRAVNIK
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);
  const { id } = await params;
  const got = await getPatientOrRes(id, user);
  if ("res" in got) return got.res;

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};
  const exerciseSetId = typeof body.exerciseSetId === "string" ? body.exerciseSetId : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  if (!exerciseSetId) return jsonError("exerciseSetId je obvezen", 400);
  if (!DATE_RE.test(startDate)) return jsonError("startDate mora biti YYYY-MM-DD", 400);

  const set = await prisma.exerciseSet.findUnique({ where: { id: exerciseSetId } });
  if (!set) return jsonError("Sklop vaj ne obstaja", 404);

  const assignment = await prisma.patientExerciseSet.upsert({
    where: { patientId_exerciseSetId: { patientId: got.patient.id, exerciseSetId } },
    create: { patientId: got.patient.id, exerciseSetId, startDate },
    update: { startDate },
    include: { exerciseSet: true },
  });
  return NextResponse.json(assignment, { status: 201 });
}

// DELETE — odstrani dodelitev sklopa vaj; samo ZDRAVNIK
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);
  const { id } = await params;
  const got = await getPatientOrRes(id, user);
  if ("res" in got) return got.res;

  const parsed = await readJson(req).catch(() => ({ ok: true, data: {} }));
  const body = parsed.ok ? parsed.data ?? {} : {};
  const exerciseSetId = typeof body.exerciseSetId === "string" ? body.exerciseSetId : "";
  if (!exerciseSetId) return jsonError("exerciseSetId je obvezen", 400);

  await prisma.patientExerciseSet.deleteMany({
    where: { patientId: got.patient.id, exerciseSetId },
  });
  return NextResponse.json({ ok: true });
}
