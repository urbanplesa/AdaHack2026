import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// POST — multipart/form-data s poljem "file" → shrani v public/uploads/, vrne { url }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Neveljaven formData", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Manjka datoteka (polje 'file')", 400);
  if (!ALLOWED[file.type]) return jsonError("Dovoljene so samo slike (JPEG, PNG, WebP)", 400);
  if (file.size > MAX_BYTES) return jsonError("Datoteka je prevelika (max 5 MB)", 400);

  const ext = ALLOWED[file.type];
  const name = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
