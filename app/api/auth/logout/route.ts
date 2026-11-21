import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST — počisti sejno in preusmeri na prijavo (uporablja ga obrazec "Odjava")
export async function POST(req: NextRequest) {
  (await cookies()).delete("session");
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
