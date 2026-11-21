import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

// GET — vsi sklopi vaj (prijavljen uporabnik)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  const sets = await prisma.exerciseSet.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(sets);
}

// POST — nov sklop vaj po meri (samo ZDRAVNIK)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("Ime sklopa je obvezno", 400);

  const set = await prisma.exerciseSet.create({
    data: {
      name,
      condition: typeof body.condition === "string" ? body.condition.trim() : "",
      instructions: typeof body.instructions === "string" ? body.instructions.trim() : "",
      pdfUrl: typeof body.pdfUrl === "string" && body.pdfUrl ? body.pdfUrl : null,
      sourceUrl: typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : null,
      language: typeof body.language === "string" ? body.language : "sl",
      kind: typeof body.kind === "string" ? body.kind : "exercise",
      pages: typeof body.pages === "number" ? body.pages : null,
    },
  });
  return NextResponse.json(set, { status: 201 });
}
