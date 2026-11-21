import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Privzeto geslo za vse paciente (hackathon demo — glej AGENTS.md)
export const DEFAULT_PATIENT_PASSWORD = "pacient123";

export async function getSessionUser() {
  const store = await cookies();
  const userId = store.get("session")?.value;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
