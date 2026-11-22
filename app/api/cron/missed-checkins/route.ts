import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { checkMissedCheckins } from "@/lib/missed-checkins";

// POST — ročni sprožilec pregleda izostalih vnosov (alarm IZOSTANEK_VNOSA).
// Isti pregled teče tudi samodejno prek instrumentation.ts (vsakih
// MISSED_CHECKINS_INTERVAL_MINUTES minut, privzeto 15) — glej lib/missed-checkins.ts.
// Zaščita: strežniška skrivnost (x-cron-secret) ALI seja zdravnika (za ročni demo klic).
export async function POST(req: NextRequest) {
  const secretOk =
    !!process.env.CRON_SECRET && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  const user = await getSessionUser();
  if (!secretOk && (!user || user.role !== "ZDRAVNIK")) {
    return jsonError("Ni dovoljenja", 403);
  }

  const result = await checkMissedCheckins();
  return NextResponse.json(result);
}
