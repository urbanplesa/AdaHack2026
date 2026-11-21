import { prisma } from "./prisma";

// AI asistent — konfiguracija iz .env (glej AGENTS.md):
//   AI_API_URL — osnovni URL OpenAI-compatible endpointa
//                (npr. https://api.openai.com/v1 ali http://localhost:11434/v1 za Ollama)
//   AI_API_KEY — API ključ (pošljemo kot Bearer)
//   AI_MODEL   — ime modela (npr. gpt-4o-mini, llama3.1)
// Če katera od treh manjka, asistent odgovarja s fallback sporočilom (demo brez ključa ne crkne).
const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 600;
const HISTORY_LIMIT = 12; // koliko zadnjih sporočil pogovora gre v LLM kontekst
const MEASUREMENTS_LIMIT = 20; // koliko zadnjih meritev gre v kontekst

export const ASSISTANT_FALLBACK =
  "Oprostite, AI asistent je trenutno nedosegljiv. Za vprašanja se obrnite na svojega zdravnika — v nujnih primerih pokličite 112.";

export function assistantConfig() {
  const url = (process.env.AI_API_URL ?? "").trim();
  const key = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL ?? "").trim();
  return { url, key, model, configured: Boolean(url && key && model) };
}

// Dovoli oba zapisa URL-ja: s končnico /chat/completions ali samo osnovo (npr. .../v1)
function completionsUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

const SYSTEM_PROMPT = `Si AI asistent aplikacije AdaHack2026 za spremljanje pacientov na domu po odpustu iz bolnišnice.
Odgovarjaj V SLOVENŠČINI, kratko, jasno in prijazno — piši za laika.
Nisi zdravnik: ne postavljaš diagnoz in ne predpisuješ zdravil. Če odgovor zadeva zdravstveno stanje, na koncu na kratko opomni, da gre za informativno podporo, in svetuj stik z zdravnikom; v nujnih primerih naj pacient pokliče 112.
Če so v kontekstu odprti alarmi (L3, SOS) ali meritve izven rdeče cone, to jasno izpostavi na začetku odgovora.
Kadar je relevantno, se sklicuj na konkretne podatke iz konteksta (zadnje meritve, mejne vrednosti merilnih načrtov, članke iz knjižnice) in povej, na kaj se sklicuješ.
Ne izmišljuj podatkov, ki niso v kontekstu.`;

type PlanRow = {
  label: string;
  type: string;
  unit: string;
  frequency: string;
  thresholdL1: number | null;
  thresholdL2: number | null;
  thresholdL3: number | null;
  thresholdLowL1: number | null;
  thresholdLowL2: number | null;
  thresholdLowL3: number | null;
  baseline: string | null;
  greenZone: string | null;
  yellowZone: string | null;
  redZone: string | null;
};

function planLine(p: PlanRow): string {
  const parts = [`${p.label} (${p.type}), enota: ${p.unit || "—"}, pogostost: ${p.frequency}`];
  const upper = (["L1", "L2", "L3"] as const)
    .map((k) => ({ k, v: p[`threshold${k}` as const] as number | null }))
    .filter((x) => x.v !== null)
    .map((x) => `${x.k} > ${x.v}`)
    .join(", ");
  const lower = (["L1", "L2", "L3"] as const)
    .map((k) => ({ k, v: p[`thresholdLow${k}` as const] as number | null }))
    .filter((x) => x.v !== null)
    .map((x) => `${x.k} < ${x.v}`)
    .join(", ");
  if (upper) parts.push(`zgornje meje: ${upper}`);
  if (lower) parts.push(`spodnje meje: ${lower}`);
  const zones = [
    p.greenZone && `zelena cona: ${p.greenZone}`,
    p.yellowZone && `rumena cona: ${p.yellowZone}`,
    p.redZone && `rdeča cona: ${p.redZone}`,
  ]
    .filter(Boolean)
    .join("; ");
  if (zones) parts.push(zones);
  if (p.baseline) parts.push(`bazna vrednost: ${p.baseline}`);
  return `- ${parts.join(" · ")}`;
}

// Kontekst asistenta: diagnoza/odpust, merilni načrti z mejami, zadnje meritve, odprti alarmi, knjižnica
async function buildContext(patientId: string): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return "";
  const plans = await prisma.measurementPlan.findMany({
    where: { patientId },
    orderBy: { label: "asc" },
  });
  const measurements = await prisma.measurement.findMany({
    where: { patientId },
    orderBy: { recordedAt: "desc" },
    take: MEASUREMENTS_LIMIT,
    include: { plan: true },
  });
  const alerts = await prisma.alert.findMany({
    where: { patientId, status: "ODPRT" },
    orderBy: { createdAt: "desc" },
  });
  const library = await prisma.libraryEntry.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  const assignments = await prisma.patientExerciseSet.findMany({
    where: { patientId },
    include: { exerciseSet: true },
    orderBy: { startDate: "asc" },
  });

  const lines: string[] = [];
  lines.push(`Diagnoza: ${patient.diagnosis}`);
  if (patient.dischargeDate) {
    lines.push(`Datum odpusta iz bolnišnice: ${patient.dischargeDate.toISOString().slice(0, 10)}`);
  }
  const careLines = [
    patient.timeline && `Okviren potek okrevanja: ${patient.timeline}`,
    patient.nutrition && `Prehrana: ${patient.nutrition}`,
    patient.generalRecommendations && `Standardna priporočila: ${patient.generalRecommendations}`,
    patient.warningSymptoms && `Opozorilni simptomi: ${patient.warningSymptoms}`,
    patient.alarmYellow && `Rumeni alarm: ${patient.alarmYellow}`,
    patient.alarmRed && `Rdeči alarm: ${patient.alarmRed}`,
    patient.equipment && `Potrebna oprema: ${patient.equipment}`,
  ].filter(Boolean) as string[];
  if (careLines.length) {
    lines.push("", "PRIPOROČILA ZA OKREVANJE (iz načrta/kataloga):");
    lines.push(...careLines.map((l) => `- ${l}`));
  }
  if (assignments.length) {
    lines.push("", "DODELJENI SKLOPI VAJ:");
    for (const a of assignments) {
      lines.push(`- ${a.exerciseSet.name} (začetek: ${a.startDate}${a.acknowledgedDate ? ", potrjeno" : ""})`);
    }
  }
  lines.push("", "MERILNI NAČRTI (z alarmnimi mejami):");
  if (plans.length) lines.push(...plans.map(planLine));
  else lines.push("- (brez načrtov)");
  lines.push("", `ZADNJE MERITVE (največ ${MEASUREMENTS_LIMIT}, najnovejše zadnje):`);
  if (!measurements.length) lines.push("- (še ni meritev)");
  for (const m of [...measurements].reverse()) {
    const when = m.recordedAt.toISOString().replace("T", " ").slice(0, 16);
    const unit = m.plan?.unit ?? "";
    const val =
      m.value !== null
        ? `${m.value}${unit ? ` ${unit}` : ""}`
        : m.valueText ?? (m.photoUrl ? "naložena slika" : "—");
    lines.push(
      `- ${when} · ${m.plan?.label ?? m.type}: ${val}${m.note ? ` · opomba: ${m.note}` : ""}${m.author === "ZDRAVNIK" ? " · vnesel zdravnik" : ""}`,
    );
  }
  lines.push("", "ODPRTI ALARMI:");
  if (!alerts.length) lines.push("- ni odprtih alarmov");
  for (const a of alerts) {
    lines.push(`- ${a.severity} (${a.createdAt.toISOString().slice(0, 10)}): ${a.message}`);
  }
  lines.push("", "KNJIŽNJICA (znanje za paciente):");
  if (library.length) {
    for (const e of library) lines.push(`- [${e.category}] ${e.title}: ${e.content}`);
  } else lines.push("- (knjižnica je prazna)");
  return lines.join("\n");
}

// Vrne odgovor asistenta. Zgodovina (PACIENT + ASISTENT) se prebere iz baze —
// klicalec naj pred tem že shrani novo sporočilo pacienta.
export async function askAssistant(patientId: string): Promise<string> {
  const cfg = assistantConfig();
  if (!cfg.configured) {
    console.warn("[assistant] AI_API_URL/AI_API_KEY/AI_MODEL niso nastavljene — fallback odgovor");
    return ASSISTANT_FALLBACK;
  }

  const context = await buildContext(patientId);
  const history = await prisma.chatMessage.findMany({
    where: { patientId, sender: { in: ["PACIENT", "ASISTENT"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nKONTEKST PACIENTA:\n${context}` },
    ...history.reverse().map((m) => ({
      role: m.sender === "PACIENT" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    })),
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(completionsUrl(cfg.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.key}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          max_tokens: MAX_TOKENS,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error(`[assistant] LLM je odgovoril ${res.status}:`, await res.text().catch(() => ""));
      return ASSISTANT_FALLBACK;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      console.error("[assistant] LLM je vrnil prazen odgovor");
      return ASSISTANT_FALLBACK;
    }
    return content.trim();
  } catch (err) {
    console.error("[assistant] klic LLM ni uspel:", err);
    return ASSISTANT_FALLBACK;
  }
}
