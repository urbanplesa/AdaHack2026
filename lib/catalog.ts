// Katalog stanj iz projekta lovable (Razsirjen_katalog_28_stanj.xlsx) + PDF vodiči
// fizioterapije SB Nova Gorica. Podatki so v lib/catalog/*.json; PDF-ji so lokalno
// v public/guides/ (preneseni iz sbng.si, sourceUrl ostane kot izvorni dokument).
//
// Ob dodajanju pacienta zdravnik izbere stanje iz kataloga → samodejno se ustvarijo
// merilni načrti (z mejami iz literalnih alarmov kataloga), priporočila za okrevanje
// in dodeljeni sklopi vaj z izračunanim datumom začetka.

import conditionsJson from "./catalog/conditions.json";
import guidesJson from "./catalog/guides.json";

export type PlanKind = "NUMERIC" | "TEXT" | "PRESSURE" | "IMAGE" | "YESNO";

export type Guide = {
  id: string;
  name: string;
  condition: string;
  instructions: string;
  sourceUrl: string;
  language: string;
  kind: "exercise" | "advice" | "exam";
  pages: number;
  pdfUrl: string; // lokalna pot /guides/<id>.pdf
};

export const guides = guidesJson.guides as Guide[];
export const guideById = (id: string) => guides.find((g) => g.id === id);
export const physiotherapySource = guidesJson.source as string;

type CatalogRow = {
  Stanje: string;
  "Meritve po odpustu": string;
  Oprema: string;
  Fizioterapija: string;
  "Začetek vaj": string;
  "Standardna priporočila": string;
  "Normalni simptomi": string;
  "Opozorilni simptomi": string;
  "Okvirno okrevanje": string;
  Prehrana: string;
  "Rumeni alarm": string;
  "Rdeči alarm": string;
};

type RawCatalog = { source: string; rows: CatalogRow[]; exerciseReferences: Record<string, string> };
const raw = conditionsJson as RawCatalog;

export type CatalogMetric = { type: string; label: string; unit: string; kind: PlanKind };

// Katalogovske oznake meritev → naši tipi planov (type, label, unit, vrsta vnosa)
const metricMapping: Record<string, CatalogMetric> = {
  RR: { type: "PRITISK", label: "Krvni pritisk", unit: "mmHg", kind: "PRESSURE" },
  HR: { type: "UTRIP", label: "Povprečen utrip", unit: "ut/min", kind: "NUMERIC" },
  SpO2: { type: "KISIK", label: "Nasičenost krvi s kisikom (SpO2)", unit: "%", kind: "NUMERIC" },
  teža: { type: "TEZA", label: "Teža", unit: "kg", kind: "NUMERIC" },
  bolečina: { type: "BOLECINA", label: "Bolečina", unit: "/10", kind: "NUMERIC" },
  edemi: { type: "EDEM", label: "Edemi / otekanje", unit: "", kind: "TEXT" },
  otekanje: { type: "EDEM", label: "Edemi / otekanje", unit: "", kind: "TEXT" },
  oteklina: { type: "EDEM", label: "Edemi / otekanje", unit: "", kind: "TEXT" },
  EKG: { type: "EKG", label: "EKG", unit: "", kind: "IMAGE" },
  gibljivost: { type: "GIBLJIVOST", label: "Gibljivost", unit: "", kind: "TEXT" },
  "RR dihanja": { type: "RESP_FREKVENCA", label: "Frekvenca dihanja", unit: "vdihov/min", kind: "NUMERIC" },
  kašelj: { type: "KASELJ", label: "Kašelj", unit: "", kind: "YESNO" },
  temp: { type: "TEMPERATURA", label: "Telesna temperatura", unit: "°C", kind: "NUMERIC" },
  rana: { type: "SLIKA_RANE", label: "Slika rane / šiva", unit: "", kind: "IMAGE" },
  blato: { type: "BLATO", label: "Blato", unit: "", kind: "TEXT" },
  okorelost: { type: "OKORELOST", label: "Okorelost", unit: "", kind: "TEXT" },
  krvavitev: { type: "KRVITEV", label: "Krvavitev", unit: "", kind: "YESNO" },
  glukoza: { type: "SLADKOR", label: "Sladkor v krvi", unit: "mmol/L", kind: "NUMERIC" },
  padci: { type: "PADCI", label: "Padci", unit: "", kind: "YESNO" },
  koraki: { type: "KORAKI", label: "Število korakov", unit: "/dan", kind: "NUMERIC" },
  hoja: { type: "HOJA", label: "Hoja", unit: "", kind: "TEXT" },
  moč: { type: "MOC", label: "Moč", unit: "", kind: "TEXT" },
  aktivnost: { type: "AKTIVNOST", label: "Aktivnost", unit: "", kind: "TEXT" },
  dihanje: { type: "DIHANJE", label: "Dihanje", unit: "", kind: "TEXT" },
  "obseg noge": { type: "OBSEG_NOGE", label: "Obseg noge", unit: "cm", kind: "NUMERIC" },
  "obseg roke": { type: "OBSEG_ROKE", label: "Obseg roke", unit: "cm", kind: "NUMERIC" },
  "obseg gibanja": { type: "OBSEG_GIBANJA", label: "Obseg gibanja", unit: "", kind: "TEXT" },
  peakflow: { type: "PEAKFLOW", label: "Največji pretok izdiha", unit: "L/min", kind: "NUMERIC" },
};

// Te meritve lovable izvz-enes iz samodečne izbire (ročno jih doda zdravnik, če želi)
const excludedFromAuto = new Set([
  "obseg noge", "moč", "hoja", "obseg gibanja", "koraki", "obseg roke", "aktivnost", "dihanje", "peakflow",
]);

// Stanja po operaciji → samodejno dodamo sliko rane
const operativeConditions = new Set([
  "Rak dojke", "Drugi raki po operaciji", "Operacija trebuha", "Menjava kolka",
  "Osteosinteza kolka", "Menjava kolena", "Artroskopija kolena", "ACL",
  "Operacija rame", "Carski rez",
]);

// Oprema po tipu meritve (iz lovable metric-support)
const equipmentByType: Record<string, string> = {
  PRITISK: "RR merilnik", UTRIP: "merilnik utripa", KISIK: "oksimeter", TEZA: "tehtnica",
  TEMPERATURA: "termometer", SLADKOR: "glukometer", EKG: "EKG", SLIKA_RANE: "telefon ali fotoaparat",
};
export const equipmentForTypes = (types: string[]) =>
  [...new Set(types.map((t) => equipmentByType[t]).filter(Boolean))].join(", ");

// Literalni alarmi kataloga → numerične meje načrta (rumeni alarm = L2, rdeči = L3).
// Parsamo samo izrecne zapise (npr. "SpO2<94"); ostalo ostane v besedilu cone.
const alarmLiterals: Record<string, { planType: string; direction: "above" | "below"; value: number }> = {
  "RR>160/100": { planType: "PRITISK", direction: "above", value: 160 },
  "RR>140/90": { planType: "PRITISK", direction: "above", value: 140 },
  "HR>110": { planType: "UTRIP", direction: "above", value: 110 },
  "SpO2<94": { planType: "KISIK", direction: "below", value: 94 },
  "SpO2<90": { planType: "KISIK", direction: "below", value: 90 },
  "37.5+": { planType: "TEMPERATURA", direction: "above", value: 37.5 },
  "38.5+": { planType: "TEMPERATURA", direction: "above", value: 38.5 },
  "glukoza>10": { planType: "SLADKOR", direction: "above", value: 10 },
  "glukoza>15": { planType: "SLADKOR", direction: "above", value: 15 },
  "bolečina>5": { planType: "BOLECINA", direction: "above", value: 5 },
};

export type CatalogPlan = {
  type: string;
  label: string;
  unit: string;
  kind: PlanKind;
  frequency: string;
  yellowZone: string;
  redZone: string;
  thresholdL2: number | null;
  thresholdL3: number | null;
  thresholdLowL2: number | null;
  thresholdLowL3: number | null;
};

export type CatalogCondition = {
  condition: string;
  metrics: CatalogMetric[];
  plans: CatalogPlan[];
  equipment: string;
  exerciseSetIds: string[];
  startGuidance: string;
  sideEffects: string;
  timeline: string;
  nutrition: string;
  recommendations: string;
  warningSymptoms: string;
  alarmYellow: string;
  alarmRed: string;
  source: string;
};

const norm = (value: string) => value.trim().toLocaleLowerCase("sl");

function zonesFor(condition: string, planType: string): Pick<CatalogPlan, "yellowZone" | "redZone" | "thresholdL2" | "thresholdL3" | "thresholdLowL2" | "thresholdLowL3"> {
  const row = raw.rows.find((r) => norm(r.Stanje) === norm(condition));
  const empty = { yellowZone: "", redZone: "", thresholdL2: null, thresholdL3: null, thresholdLowL2: null, thresholdLowL3: null };
  if (!row) return empty;
  const pick = (text: string, level: "L2" | "L3") => {
    const hits = text.split(",").map((s) => s.trim()).filter((s) => alarmLiterals[s]?.planType === planType);
    const zoneText = hits.join(", ");
    let value: number | null = null;
    const first = hits.map((h) => alarmLiterals[h]).find(Boolean);
    if (first) value = first.value;
    return { zoneText, value, direction: first?.direction ?? null };
  };
  const yellow = pick(row["Rumeni alarm"], "L2");
  const red = pick(row["Rdeči alarm"], "L3");
  return {
    yellowZone: yellow.zoneText,
    redZone: red.zoneText,
    thresholdL2: yellow.direction === "above" ? yellow.value : null,
    thresholdLowL2: yellow.direction === "below" ? yellow.value : null,
    thresholdL3: red.direction === "above" ? red.value : null,
    thresholdLowL3: red.direction === "below" ? red.value : null,
  };
}

function toCondition(row: CatalogRow): CatalogCondition {
  const metricKeys = row["Meritve po odpustu"].split(",").map((s) => s.trim()).filter((s) => !excludedFromAuto.has(s));
  const mapped = metricKeys.map((k) => metricMapping[k]).filter(Boolean);
  const withRequired: CatalogMetric[] = [
    { type: "POCUTJE", label: "Počutje", unit: "", kind: "TEXT" },
    { type: "BOLECINA", label: "Bolečina", unit: "/10", kind: "NUMERIC" },
    ...mapped.filter((m) => m.type !== "BOLECINA"),
  ];
  if (operativeConditions.has(row.Stanje) && !withRequired.some((m) => m.type === "SLIKA_RANE")) {
    withRequired.push({ type: "SLIKA_RANE", label: "Slika rane / šiva", unit: "", kind: "IMAGE" });
  }
  const deduped = withRequired.filter((m, i, arr) => arr.findIndex((x) => x.type === m.type) === i);
  const plans: CatalogPlan[] = deduped.map((m) => ({
    type: m.type,
    label: m.label,
    unit: m.unit,
    kind: m.kind,
    frequency: "Po navodilu zdravnika",
    ...zonesFor(row.Stanje, m.type),
  }));
  const exerciseSetIds = row.Fizioterapija.split(",").map((s) => raw.exerciseReferences[s.trim()]).filter(Boolean);
  return {
    condition: row.Stanje,
    metrics: deduped,
    plans,
    equipment: row.Oprema.split(",").map((s) => s.trim()).filter((s) => s && s !== "peakflow").join(", "),
    exerciseSetIds,
    startGuidance: row["Začetek vaj"],
    sideEffects: row["Normalni simptomi"],
    timeline: row["Okvirno okrevanje"],
    nutrition: row["Prehrana"],
    recommendations: row["Standardna priporočila"],
    warningSymptoms: row["Opozorilni simptomi"],
    alarmYellow: row["Rumeni alarm"],
    alarmRed: row["Rdeči alarm"],
    source: raw.source,
  };
}

let cache: CatalogCondition[] | null = null;
export function listCatalogConditions(): CatalogCondition[] {
  if (!cache) cache = raw.rows.map(toCondition);
  return cache;
}

export function findCatalogCondition(diagnosis: string): CatalogCondition | null {
  const n = norm(diagnosis);
  return listCatalogConditions().find((c) => norm(c.condition) === n) ?? null;
}

// ---------- Datum začetka vaj ----------

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const startOffsets: Record<string, [number, number]> = {
  "1. dan": [1, 1],
  "1-3 dni": [1, 3],
  "1-7 dni": [1, 7],
  "24-48h": [1, 2],
  "po porodu": [0, 0],
};

// Okno začetka vaj iz kataloga + datuma posega (sredina razpona, kot v lovable)
export function exerciseStartWindow(startGuidance: string, procedureDate: string | null | undefined): { first: string; last: string; midpoint: string } | null {
  if (!procedureDate || !/^\d{4}-\d{2}-\d{2}$/.test(procedureDate)) return null;
  const [y, m, d] = procedureDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const offset = startOffsets[startGuidance];
  if (!offset) return null;
  const addDays = (days: number) => localDateKey(new Date(y, m - 1, d + days));
  return { first: addDays(offset[0]), last: addDays(offset[1]), midpoint: addDays(Math.floor((offset[0] + offset[1]) / 2)) };
}

// Samodezni datum začetka: "takoj" → danes, sicer sredina okna; po navodilu → prazno (zdravnik določi)
export function autoExerciseStartDate(startGuidance: string, procedureDate: string | null | undefined, today = localDateKey(new Date())): string {
  if (startGuidance === "takoj") return today;
  return exerciseStartWindow(startGuidance, procedureDate)?.midpoint ?? "";
}
