import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

async function requireDoctor() {
  const user = await getSessionUser();
  if (!user) return { res: jsonError("Ni prijave", 401) as NextResponse } as const;
  if (user.role !== "ZDRAVNIK") return { res: jsonError("Ni dovoljenja", 403) as NextResponse } as const;
  return { user } as const;
}

// PATCH — posodobi vnos knjižnjice (samo ZDRAVNIK)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const got = await requireDoctor();
  if ("res" in got) return got.res;
  const { id } = await params;
  const existing = await prisma.libraryEntry.findUnique({ where: { id } });
  if (!existing) return jsonError("Vnos ne obstaja", 404);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

  const entry = await prisma.libraryEntry.update({
    where: { id },
    data: {
      ...(str(body.category) ? { category: str(body.category)!.toUpperCase() } : {}),
      ...(str(body.title) !== undefined ? { title: str(body.title)! } : {}),
      ...(str(body.content) !== undefined ? { content: str(body.content)! } : {}),
      ...(body.url !== undefined ? { url: str(body.url) || null } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: str(body.sourceUrl) || null } : {}),
    },
  });
  return NextResponse.json(entry);
}

// DELETE — odstrani vnos knjižnjice (samo ZDRAVNIK)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const got = await requireDoctor();
  if ("res" in got) return got.res;
  const { id } = await params;
  const existing = await prisma.libraryEntry.findUnique({ where: { id } });
  if (!existing) return jsonError("Vnos ne obstaja", 404);
  await prisma.libraryEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
