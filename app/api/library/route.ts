import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

// GET — knjižnjica (prijavljen uporabnik)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  const entries = await prisma.libraryEntry.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(entries);
}

// POST — nov vnos v knjižnjico (samo ZDRAVNIK)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};
  const category = typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!category || !title || !content) {
    return jsonError("Kategorija, naslov in vsebina so obvezni", 400);
  }

  const entry = await prisma.libraryEntry.create({
    data: {
      category,
      title,
      content,
      url: typeof body.url === "string" && body.url ? body.url : null,
      sourceUrl: typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : null,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
