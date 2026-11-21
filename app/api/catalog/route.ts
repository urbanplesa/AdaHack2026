import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { guides, listCatalogConditions, physiotherapySource } from "@/lib/catalog";

// GET — katalog 28 stanj (za izbiro pri dodajanju pacienta) + PDF vodiči fizioterapije
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Ni prijave", 401);

  return NextResponse.json({
    source: listCatalogConditions()[0]?.source ?? "",
    physiotherapySource,
    conditions: listCatalogConditions().map((c) => ({
      condition: c.condition,
      metrics: c.metrics,
      plans: c.plans,
      equipment: c.equipment,
      exerciseSetIds: c.exerciseSetIds,
      startGuidance: c.startGuidance,
      sideEffects: c.sideEffects,
      timeline: c.timeline,
      nutrition: c.nutrition,
      recommendations: c.recommendations,
      warningSymptoms: c.warningSymptoms,
      alarmYellow: c.alarmYellow,
      alarmRed: c.alarmRed,
    })),
    guides,
  });
}
