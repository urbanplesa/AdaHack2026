import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.password !== password) {
    return NextResponse.json(
      { error: "Napačen e-poštni naslov ali geslo" },
      { status: 401 }
    );
  }

  (await cookies()).set("session", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  const redirectTo = user.role === "ZDRAVNIK" ? "/zdravnik" : "/pacient";
  return NextResponse.json({ ok: true, redirectTo });
}
