import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getSessionUser() {
  const store = await cookies();
  const userId = store.get("session")?.value;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
