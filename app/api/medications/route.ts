import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

function todayLocal(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function parseSlots(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// POST — preklopi (vzame/odvzame) današnji termin zdravila: { medicationId, time: "HH:MM" }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "PACIENT") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};

  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return jsonError("Ni profila pacienta", 404);

  const medication = await prisma.medication.findFirst({
    where: { id: body.medicationId, patientId: patient.id },
  });
  if (!medication) return jsonError("Zdravilo ni najdeno", 404);

  const time = typeof body.time === "string" ? body.time : "";
  if (!/^\d{2}:\d{2}$/.test(time)) return jsonError("Neveljaven čas (HH:MM)", 400);

  const slot = `${todayLocal()} ${time}`;
  const slots = parseSlots(medication.takenSlots);
  const updated = await prisma.medication.update({
    where: { id: medication.id },
    data: { takenSlots: JSON.stringify(slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot]) },
  });
  return NextResponse.json(updated);
}
