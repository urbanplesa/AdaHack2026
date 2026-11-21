import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

// GET — standardne meje bolnice (prijavljen uporabnik)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  const standards = await prisma.standard.findMany({ orderBy: { metricType: "asc" } });
  return NextResponse.json(standards);
}

// POST — upsert standarda po metricType (samo ZDRAVNIK)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);
  if (user.role !== "ZDRAVNIK") return jsonError("Ni dovoljenja", 403);

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data ?? {};
  const metricType = typeof body.metricType === "string" ? body.metricType.trim().toUpperCase() : "";
  if (!metricType) return jsonError("metricType je obvezen", 400);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const standard = await prisma.standard.upsert({
    where: { metricType },
    create: {
      metricType,
      label: str(body.label) ?? metricType,
      unit: typeof body.unit === "string" ? body.unit : "",
      thresholdL1: num(body.thresholdL1),
      thresholdL2: num(body.thresholdL2),
      thresholdL3: num(body.thresholdL3),
      thresholdLowL1: num(body.thresholdLowL1),
      thresholdLowL2: num(body.thresholdLowL2),
      thresholdLowL3: num(body.thresholdLowL3),
      greenZone: str(body.greenZone),
      yellowZone: str(body.yellowZone),
      redZone: str(body.redZone),
    },
    update: {
      ...(str(body.label) !== null ? { label: str(body.label) ?? undefined } : {}),
      ...(typeof body.unit === "string" ? { unit: body.unit } : {}),
      ...(body.thresholdL1 !== undefined ? { thresholdL1: num(body.thresholdL1) } : {}),
      ...(body.thresholdL2 !== undefined ? { thresholdL2: num(body.thresholdL2) } : {}),
      ...(body.thresholdL3 !== undefined ? { thresholdL3: num(body.thresholdL3) } : {}),
      ...(body.thresholdLowL1 !== undefined ? { thresholdLowL1: num(body.thresholdLowL1) } : {}),
      ...(body.thresholdLowL2 !== undefined ? { thresholdLowL2: num(body.thresholdLowL2) } : {}),
      ...(body.thresholdLowL3 !== undefined ? { thresholdLowL3: num(body.thresholdLowL3) } : {}),
      ...(body.greenZone !== undefined ? { greenZone: str(body.greenZone) } : {}),
      ...(body.yellowZone !== undefined ? { yellowZone: str(body.yellowZone) } : {}),
      ...(body.redZone !== undefined ? { redZone: str(body.redZone) } : {}),
    },
  });
  return NextResponse.json(standard, { status: 201 });
}
