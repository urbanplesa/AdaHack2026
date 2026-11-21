import { NextRequest, NextResponse } from "next/server";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Varno branje JSON body-ja — ob neveljavnem JSON-u vrne 400 namesto 500
export async function readJson(
  req: NextRequest,
): Promise<{ ok: true; data: any } | { ok: false; res: NextResponse }> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return { ok: false, res: jsonError("Neveljaven JSON", 400) };
  }
}
