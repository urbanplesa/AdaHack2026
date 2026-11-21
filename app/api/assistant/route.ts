import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { askAssistant } from "@/lib/assistant";

const MAX_TEXT_LENGTH = 1000;

async function requirePatient() {
  const user = await getSessionUser();
  if (!user) return { error: jsonError("Ni prijave", 401) as NextResponse } as const;
  if (user.role !== "PACIENT") return { error: jsonError("Ni dovoljenja", 403) as NextResponse } as const;
  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return { error: jsonError("Ni profila pacienta", 404) as NextResponse } as const;
  return { patient } as const;
}

// GET — zgodovina pogovora pacienta z AI asistentom (sporočila PACIENT + ASISTENT)
export async function GET(_req: NextRequest) {
  const result = await requirePatient();
  if ("error" in result) return result.error;
  const messages = await prisma.chatMessage.findMany({
    where: { patientId: result.patient.id, sender: { in: ["PACIENT", "ASISTENT"] } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

// POST — novo vprašanje asistentu {text}; oba zapisa (PACIENT in ASISTENT) se shranita v ChatMessage
export async function POST(req: NextRequest) {
  const result = await requirePatient();
  if ("error" in result) return result.error;
  const patient = result.patient;

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const text = typeof parsed.data?.text === "string" ? parsed.data.text.trim() : "";
  if (!text) return jsonError("Sporočilo je obvezno", 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError(`Sporočilo je predolgo (največ ${MAX_TEXT_LENGTH} znakov)`, 400);
  }

  const userMessage = await prisma.chatMessage.create({
    data: { patientId: patient.id, sender: "PACIENT", text },
  });
  const reply = await askAssistant(patient.id);
  const assistantMessage = await prisma.chatMessage.create({
    data: { patientId: patient.id, sender: "ASISTENT", text: reply },
  });
  return NextResponse.json({ userMessage, assistantMessage }, { status: 201 });
}
