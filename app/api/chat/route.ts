import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

// GET — pacient vidi svoj chat; zdravnik z ?patientId= chat izbranega pacienta
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  let patientId: string | null = null;
  if (user.role === "ZDRAVNIK") {
    patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) return jsonError("Manjka patientId", 400);
  } else if (user.role === "PACIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    patientId = patient?.id ?? null;
  } else {
    return jsonError("Ni dovoljenja", 403);
  }
  if (!patientId) return jsonError("Ni profila pacienta", 404);

  const messages = await prisma.chatMessage.findMany({
    where: { patientId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

// POST — novo sporočilo. Pacient pošilja sebi; zdravnik mora podati patientId.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("Sporočilo je obvezno", 400);

  let patientId: string | null = null;
  let sender: string;
  if (user.role === "PACIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    patientId = patient?.id ?? null;
    sender = "PACIENT";
  } else if (user.role === "ZDRAVNIK") {
    patientId = typeof body.patientId === "string" ? body.patientId : null;
    sender = "ZDRAVNIK";
  } else {
    return jsonError("Ni dovoljenja", 403);
  }
  if (!patientId) return jsonError("Ni profila pacienta", 404);

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return jsonError("Pacient ni najden", 404);

  const message = await prisma.chatMessage.create({
    data: { patientId: patient.id, sender, text },
  });
  return NextResponse.json(message, { status: 201 });
}
