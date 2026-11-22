"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  HeartPulse,
  ImagePlus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import TrendChart from "@/components/TrendChart";

type Plan = {
  id: string; type: string; label: string; unit: string; frequency: string; kind: string;
  thresholdL1: number | null; thresholdL2: number | null; thresholdL3: number | null;
  thresholdLowL1: number | null; thresholdLowL2: number | null; thresholdLowL3: number | null;
  baseline: string | null; greenZone: string | null; yellowZone: string | null; redZone: string | null;
};
type Measurement = { id: string; type: string; value: number | null; valueText: string | null; note: string | null; photoUrl: string | null; author: string; severity: string | null; recordedAt: string | Date };
type LibraryEntry = { id: string; category: string; title: string; content: string; url: string | null; sourceUrl: string | null };
type ExerciseSet = { id: string; name: string; condition: string; instructions: string; pdfUrl: string | null; sourceUrl: string | null; language: string; kind: string; pages: number | null };
type ExerciseAssignment = { id: string; exerciseSetId: string; startDate: string; acknowledgedDate: string | null; exerciseSet: ExerciseSet };
type Medication = { id: string; name: string; dosage: string; times: string; takenSlots: string };
type ChatMessage = { id: string; sender: string; text: string; createdAt: string | Date };
type PatientAlert = { id: string; severity: string; status: string; message: string; createdAt: string | Date; measurementType: string | null };
type Care = {
  sideEffects: string | null; timeline: string | null; nutrition: string | null; exercises: string | null;
  generalRecommendations: string | null; equipment: string | null; warningSymptoms: string | null;
  alarmYellow: string | null; alarmRed: string | null; catalogSource: string | null;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateKeyOf = (d: string | Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const fieldClass = "mt-1 w-full min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-lg text-foreground outline-none focus:border-primary";

// Slider namesto številskega vnosa za KISIK in TEMPERATURO
const sliderRange = (plan: Plan): { min: number; max: number; step: number; def: string } | null =>
  plan.type === "KISIK" ? { min: 80, max: 100, step: 1, def: "98" }
  : plan.type === "TEMPERATURA" ? { min: 35, max: 41, step: 0.1, def: "36.6" }
  : null;

export default function PatientDashboardLovable(props: {
  patientName: string; diagnosis: string; dischargeDate: string; care: Care;
  plans: Plan[]; measurements: Measurement[]; libraryEntries: LibraryEntry[];
  exerciseAssignments: ExerciseAssignment[]; medications: Medication[]; chatMessages: ChatMessage[]; alerts: PatientAlert[];
}) {
  const [tab, setTab] = useState("measurements");
  const [measurements, setMeasurements] = useState(props.measurements);
  const [medications, setMedications] = useState(props.medications);
  const [assignments, setAssignments] = useState(props.exerciseAssignments);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>(props.chatMessages);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [liveAlert, setLiveAlert] = useState<PatientAlert | null>(null);

  // Alarmi: vsi (iz strežnika) + morebitni ravnokar sprožen (še ni v props)
  const allAlerts = useMemo(
    () => (liveAlert && !props.alerts.some((a) => a.id === liveAlert.id) ? [liveAlert, ...props.alerts] : props.alerts),
    [props.alerts, liveAlert],
  );
  const openAlerts = allAlerts.filter((a) => a.status === "ODPRT");
  const criticalAlerts = openAlerts.filter((a) => a.severity === "L3" || a.severity === "SOS");
  const warningAlerts = openAlerts.filter((a) => a.severity !== "L3" && a.severity !== "SOS");
  function handleSaved(item: Measurement & { alert?: PatientAlert | null }) {
    setMeasurements((old) => [item, ...old]);
    if (item.alert) setLiveAlert(item.alert);
  }

  // Današnje meritve: vsak načrt naj ima vsaj en vnos pacienta danes
  const today = todayKey();
  const measuredToday = useMemo(
    () => new Set(measurements.filter((m) => m.author === "PACIENT" && dateKeyOf(m.recordedAt) === today).map((m) => m.type)),
    [measurements, today],
  );
  const pendingPlans = props.plans.filter((p) => !measuredToday.has(p.type));
  const dailyComplete = props.plans.length > 0 && pendingPlans.length === 0;
  function openReadings() {
    setTab("measurements");
    window.requestAnimationFrame(() => document.getElementById("daily-readings")?.focus());
  }

  // Opomnik za vaje: sklopi s startDate <= danes, ki še niso potrjeni
  const dueExercises = useMemo(
    () => assignments.filter((a) => a.startDate && a.startDate <= today && a.acknowledgedDate !== a.startDate && (a.exerciseSet.kind === "exercise" || !a.exerciseSet.kind)),
    [assignments, today],
  );
  async function acknowledge(id: string) {
    const res = await fetch(`/api/exercise-assignments/${id}/acknowledge`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setAssignments((old) => old.map((a) => (a.id === id ? { ...a, acknowledgedDate: updated.acknowledgedDate } : a)));
    }
  }

  const tabs = [
    ["measurements", "Meritve", HeartPulse],
    ["library", "Knjižnjica", BookOpen],
    ["ai", "AI asistent", Sparkles],
  ] as const;

  const now = new Date();
  return <>
    <div className="pt-4">
      <h1 className="font-display text-4xl">Živjo, {props.patientName.split(" ")[0]}.</h1>
      <p className="mt-2 text-base capitalize text-muted-foreground">{now.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" })}</p>
    </div>

    {props.plans.length > 0 && (dailyComplete ? (
      <p role="status" className="my-6 flex items-center gap-3 border-y py-5 text-base font-semibold text-primary">
        <CheckCircle2 className="h-6 w-6 shrink-0" />Današnje meritve so izpolnjene.
      </p>
    ) : (
      <button type="button" onClick={openReadings} className="my-6 flex h-auto w-full items-center justify-between gap-4 whitespace-normal rounded-lg bg-primary px-5 py-5 text-left text-lg font-bold leading-relaxed text-white">
        <span>{measuredToday.size === 0 ? "Danes še nisi vnesel meritev, naredi to zdaj!" : `Danes še nisi vnesel vseh meritev (${measuredToday.size}/${props.plans.length}). Nadaljuj zdaj!`}</span>
        <ArrowRight className="shrink-0" />
      </button>
    ))}

    {criticalAlerts.length > 0 && (
      <section aria-label="Kritični alarm" className="mb-6 flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 className="font-bold text-destructive">Kritično stanje — takoj pokličite 112</h2>
          {criticalAlerts.map((a) => <p key={a.id} className="mt-2 text-sm text-destructive">{a.message}</p>)}
        </div>
      </section>
    )}
    {warningAlerts.length > 0 && (
      <section aria-label="Opozorila" className="mb-6 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-5">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <h2 className="font-bold text-accent-foreground">Opozorila — zdravnik je obveščen</h2>
          {warningAlerts.map((a) => <p key={a.id} className="mt-2 text-sm text-accent-foreground">{a.message}</p>)}
        </div>
      </section>
    )}

    {dueExercises.length > 0 && (
      <section aria-label="Opomnik za začetek vaj" className="mb-6 border-y border-warning/40 bg-warning/10 px-4 py-4">
        <h2 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-warning" />Čas je za začetek vaj</h2>
        {dueExercises.map((a) => (
          <div key={a.id} className="mt-4 border-t border-warning/30 pt-3">
            <p className="break-words text-sm font-semibold">{a.exerciseSet.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Začetek po navodilu zdravnika: {a.startDate}</p>
            <GuideLinks set={a.exerciseSet} />
          </div>
        ))}
        <button type="button" onClick={() => dueExercises.forEach((a) => acknowledge(a.id))} className="mt-4 flex items-center gap-2 rounded-xl border border-warning bg-card px-4 py-2 text-sm font-bold text-accent-foreground"><Check className="h-4 w-4" />Potrdi prejem opomnika</button>
      </section>
    )}

    <div className="mb-6 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label="Odseki pacienta">
      {tabs.map(([id, label, Icon]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-bold ${tab === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>

    {tab === "measurements" && (
      <div id="daily-readings" tabIndex={-1} className="outline-none">
        <MeasurementsWizard plans={props.plans} measurements={measurements} onSaved={handleSaved} howTo={props.libraryEntries.filter((e) => e.category === "MERITVE")} assignments={assignments} onAcknowledgeExercise={acknowledge} />
      </div>
    )}
    {tab === "library" && <LibraryView diagnosis={props.diagnosis} dischargeDate={props.dischargeDate} care={props.care} entries={props.libraryEntries} plans={props.plans} medications={medications} onMedicationsChanged={setMedications} assignments={assignments} onAcknowledge={acknowledge} />}
    {tab === "ai" && <Ai messages={aiMessages} text={aiText} onText={setAiText} loading={aiLoading} onSend={async () => { if (!aiText.trim() || aiLoading) return; const text = aiText.trim(); setAiText(""); setAiLoading(true); try { const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); if (res.ok) { const data = await res.json(); setAiMessages((old) => [...old, data.userMessage, data.assistantMessage]); } } finally { setAiLoading(false); } }} />}
  </>;
}

function GuideLinks({ set }: { set: ExerciseSet }) {
  if (!set.pdfUrl) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">SB Nova Gorica · {set.language === "sq" ? "albanščina" : "slovenščina"}{set.pages ? ` · ${set.pages} str.` : ""}{set.kind === "exam" ? " · preiskava" : set.kind === "advice" ? " · priporočila" : " · vaje"}</span>
    <a href={set.pdfUrl} target="_blank" rel="noreferrer" aria-label={`Odpri PDF: ${set.name}`} className="flex items-center gap-1 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary hover:bg-secondary"><FileText className="h-3.5 w-3.5" />PDF</a>
    {set.sourceUrl && <a href={set.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Izvirni vir: ${set.name}`} title="Izvirni dokument bolnišnice" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><ExternalLink className="h-4 w-4" /></a>}
  </div>;
}

// --- Čarovnik za meritve (po vzoru lovable PatientReadings) ---

type Draft = { value?: string; second?: string; text?: string; note?: string; photoUrl?: string; mood?: number; symptoms?: string[] };

function MeasurementsWizard({ plans, measurements, onSaved, howTo, assignments, onAcknowledgeExercise }: { plans: Plan[]; measurements: Measurement[]; onSaved: (m: Measurement & { alert?: PatientAlert | null }) => void; howTo: LibraryEntry[]; assignments: ExerciseAssignment[]; onAcknowledgeExercise: (id: string) => void }) {
  const today = todayKey();
  // Vaje, ki jih pacient že lahko dela (startDate <= danes)
  const dueAssignments = useMemo(
    () => assignments.filter((a) => a.startDate && a.startDate <= today && (a.exerciseSet.kind === "exercise" || !a.exerciseSet.kind)),
    [assignments, today],
  );
  const measuredTypes = useMemo(
    () => new Set(measurements.filter((m) => m.author === "PACIENT" && dateKeyOf(m.recordedAt) === today).map((m) => m.type)),
    [measurements, today],
  );
  const pending = plans.filter((p) => !measuredTypes.has(p.type));
  const initiallyComplete = plans.length > 0 && pending.length === 0;

  const [steps, setSteps] = useState<Plan[]>(() => (initiallyComplete ? plans : pending));
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(initiallyComplete);
  const [saving, setSaving] = useState(false);
  const [critical, setCritical] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 0) heading.current?.focus(); }, [step]);

  function update(id: string, patch: Draft) {
    setDrafts((old) => ({ ...old, [id]: { ...old[id], ...patch } }));
    setError("");
  }

  function buildBody(plan: Plan, d: Draft): Record<string, unknown> | null {
    const kind = plan.kind || "NUMERIC";
    const note = (d.note ?? "").trim();
    if (plan.type === "POCUTJE") {
      const moods = ["Zelo slabo", "Slabo", "Normalno", "Dobro", "Odlično"];
      if (!d.mood) return null;
      const text = [moods[d.mood - 1], ...(d.symptoms ?? [])].join(", ");
      return { type: plan.type, valueText: text, note };
    }
    if (kind === "NUMERIC") {
      const raw = d.value ?? sliderRange(plan)?.def;
      if (raw === undefined || raw === "") return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return { type: plan.type, value: n, note };
    }
    if (kind === "PRESSURE") {
      if (!d.value || !d.second) return null;
      return { type: plan.type, valueText: `${d.value}/${d.second}`, note };
    }
    if (kind === "YESNO") {
      if (!d.value) return null;
      return { type: plan.type, valueText: d.value, note };
    }
    if (kind === "IMAGE") {
      if (!d.photoUrl) return null;
      return { type: plan.type, note, photoUrl: d.photoUrl };
    }
    // TEXT
    if (!d.text?.trim()) return null;
    return { type: plan.type, valueText: d.text.trim(), note };
  }

  async function submitCurrent() {
    const plan = steps[step];
    if (!plan || saving) return;
    const body = buildBody(plan, drafts[plan.id] ?? {});
    if (!body) { setError("Najprej izpolnite to meritev."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shranjevanje ni uspelo");
      onSaved(data);
      if (data.alert && (data.alert.severity === "L3" || data.alert.severity === "SOS")) setCritical(true);
      if (step < steps.length - 1) setStep(step + 1);
      else { setSent(true); setDrafts({}); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shranjevanje ni uspelo");
    } finally {
      setSaving(false);
    }
  }

  async function upload(planId: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Izberite slikovno datoteko."); return; }
    setError("Nalagam sliko…");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const u = await up.json();
    if (!up.ok) { setError(u.error || "Nalaganje ni uspelo"); return; }
    update(planId, { photoUrl: u.url });
    setError("");
  }

  function reset() {
    setSteps(plans);
    setStep(0);
    setDrafts({});
    setSent(false);
    setCritical(false);
    setError("");
  }

  const criticalNotice = critical && (
    <div role="alert" className="space-y-2 border-l-2 border-destructive bg-destructive/10 p-4 text-base">
      <p className="font-bold text-destructive">Meritev je v rdečem območju; zdravnik ima opozorilo.</p>
      <p className="text-sm">To ni zdravniška ocena. Ob hudih simptomih ali nujnem stanju ne čakaj na aplikacijo; pokličite 112.</p>
    </div>
  );

  if (!plans.length) return <p className="py-10 text-lg text-muted-foreground">Zdravnik še ni izbral meritev zate.</p>;

  if (sent) {
    return (
      <section className="space-y-6 py-6" aria-label="Zaključene meritve">
        {criticalNotice}
        <div role="status" className="space-y-4">
          <CheckCircle2 aria-hidden="true" className="h-12 w-12 text-primary" />
          <h2 className="font-display text-3xl">Super, hvala za opravljene meritve!</h2>
          <p className="text-lg text-muted-foreground">Tvoje meritve so v pregledu pri zdravniku.</p>
        </div>
        {dueAssignments.length > 0 && (
          <section aria-label="Vaje, ki jih lahko že delaš" className="rounded-2xl border border-primary/40 bg-secondary/60 p-5">
            <h3 className="font-display text-2xl">Čas je za vaje</h3>
            <p className="mt-1 text-sm text-muted-foreground">Vaje izvajaj od datuma, ki ga je določil zdravnik.</p>
            <div className="mt-3 space-y-4">
              {dueAssignments.map((a) => (
                <div key={a.id} className="border-t border-primary/20 pt-3">
                  <p className="break-words font-semibold">{a.exerciseSet.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Začetek vaj: {a.startDate}{a.acknowledgedDate ? ` · opomnik potrjen ${a.acknowledgedDate}` : ""}</p>
                  {a.exerciseSet.instructions && <p className="mt-1 whitespace-pre-wrap text-sm">{a.exerciseSet.instructions}</p>}
                  <GuideLinks set={a.exerciseSet} />
                  {!a.acknowledgedDate && (
                    <button type="button" onClick={() => onAcknowledgeExercise(a.id)} className="mt-2 flex items-center gap-1 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary"><Check className="h-3.5 w-3.5" />Potrdi prejem opomnika</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        <button type="button" onClick={reset} className="flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 text-base font-bold hover:bg-muted">Vnesi nove meritve<ArrowRight className="h-4 w-4" /></button>
        <History plans={plans} measurements={measurements} />
        <HowToMeasure entries={howTo} />
      </section>
    );
  }

  const plan = steps[step];
  const kind = plan.kind || "NUMERIC";
  const d = drafts[plan.id] ?? {};
  const guidance = [plan.frequency, plan.baseline && `izhodišče: ${plan.baseline}`, plan.greenZone && `zelena: ${plan.greenZone}`, plan.yellowZone && `rumena: ${plan.yellowZone}`, plan.redZone && `rdeča: ${plan.redZone}`].filter(Boolean).join(" · ");

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submitCurrent(); }} className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-base font-semibold text-primary">Meritev {step + 1} od {steps.length}</p>
        <span className="text-sm text-muted-foreground">Danes</span>
      </div>
      <section aria-label={plan.label} className="min-w-0 space-y-6">
        <h2 ref={heading} tabIndex={-1} className="font-display text-3xl outline-none">
          {plan.label}{plan.unit && plan.type !== "BOLECINA" ? ` (${plan.unit})` : ""}
        </h2>
        {guidance && <p className="text-base leading-relaxed text-muted-foreground">{guidance}</p>}

        {plan.type === "POCUTJE" ? (
          <>
            <fieldset>
              <legend className="mb-3 text-base font-semibold">Kako se počutite?</legend>
              <div className="flex flex-wrap gap-3">
                {["😣", "🙁", "😐", "🙂", "😄"].map((m, i) => (
                  <button key={i} type="button" aria-label={`Počutje ${i + 1}: ${["Zelo slabo", "Slabo", "Normalno", "Dobro", "Odlično"][i]}`} aria-pressed={d.mood === i + 1}
                    onClick={() => update(plan.id, { mood: i + 1 })}
                    className={`h-14 w-14 rounded-xl text-3xl ${d.mood === i + 1 ? "bg-secondary ring-2 ring-primary" : "bg-muted"}`}>{m}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-base font-semibold">Simptomi</legend>
              <div className="flex flex-wrap gap-2">
                {["Glavobol", "Utrujenost", "Vročina", "Kašelj", "Bolečine", "Slabost"].map((s) => (
                  <button key={s} type="button" aria-pressed={(d.symptoms ?? []).includes(s)}
                    onClick={() => update(plan.id, { symptoms: (d.symptoms ?? []).includes(s) ? (d.symptoms ?? []).filter((x) => x !== s) : [...(d.symptoms ?? []), s] })}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${(d.symptoms ?? []).includes(s) ? "border-primary bg-primary text-white" : "border-border bg-card"}`}>{s}</button>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}

        {plan.type === "BOLECINA" && kind === "NUMERIC" ? (
          <fieldset>
            <legend className="mb-3 text-base font-semibold">Bolečina od 0 do 10</legend>
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button key={n} type="button" aria-pressed={d.value === String(n)} onClick={() => update(plan.id, { value: String(n) })}
                  className={`min-h-12 rounded-xl border text-lg font-bold ${d.value === String(n) ? "border-primary bg-primary text-white" : "border-border bg-card"}`}>{n}</button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {plan.type !== "POCUTJE" && plan.type !== "BOLECINA" && kind === "NUMERIC" && (() => {
          const r = sliderRange(plan);
          if (r) {
            const shown = d.value ?? r.def;
            return (
              <label className="block text-base font-semibold">{plan.label}
                <span className="mt-2 block font-display text-4xl text-primary">{shown}{plan.unit ? ` ${plan.unit}` : ""}</span>
                <input type="range" min={r.min} max={r.max} step={r.step} value={Number(shown)} onChange={(e) => update(plan.id, { value: e.target.value })} className="mt-4 h-8 w-full accent-primary" aria-label={plan.label} />
                <span className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{r.min}{plan.unit ? ` ${plan.unit}` : ""}</span><span>{r.max}{plan.unit ? ` ${plan.unit}` : ""}</span></span>
              </label>
            );
          }
          return (
            <label className="block text-base font-semibold">{plan.label}
              <input type="number" step="0.1" inputMode="decimal" value={d.value ?? ""} onChange={(e) => update(plan.id, { value: e.target.value })} className={fieldClass} placeholder={plan.unit} />
            </label>
          );
        })()}

        {kind === "PRESSURE" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-base font-semibold">Sistolični
              <input type="number" inputMode="numeric" value={d.value ?? ""} onChange={(e) => update(plan.id, { value: e.target.value })} className={fieldClass} placeholder="120" />
            </label>
            <label className="block text-base font-semibold">Diastolični
              <input type="number" inputMode="numeric" value={d.second ?? ""} onChange={(e) => update(plan.id, { second: e.target.value })} className={fieldClass} placeholder="80" />
            </label>
          </div>
        )}

        {kind === "YESNO" && (
          <fieldset>
            <legend className="mb-3 text-base font-semibold">{plan.label}</legend>
            <div className="flex flex-wrap gap-3">
              {["Ja", "Ne"].map((option) => (
                <button key={option} type="button" aria-pressed={d.value === option} onClick={() => update(plan.id, { value: option })}
                  className={`flex h-auto min-h-14 min-w-20 items-center gap-2 whitespace-normal rounded-xl border px-5 py-3 text-lg font-semibold ${d.value === option ? "border-primary bg-primary text-white" : "border-border bg-card"}`}>
                  {d.value === option && <Check aria-hidden="true" className="h-5 w-5" />}{option}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {kind === "TEXT" && plan.type !== "POCUTJE" && (
          <label className="block text-base font-semibold">{plan.label}
            <textarea rows={3} value={d.text ?? ""} onChange={(e) => update(plan.id, { text: e.target.value })} className={`${fieldClass} min-h-32`} placeholder="Npr. dobro, malo utrujen" />
          </label>
        )}

        {kind === "IMAGE" && (
          <div>
            <span className="mb-3 block text-base font-semibold">Priložite sliko</span>
            <div className="flex min-w-0 items-center gap-2">
              <ImagePlus className="h-5 w-5 shrink-0 text-primary" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void upload(plan.id, e.target.files?.[0])} className="w-full min-w-0 text-sm" />
            </div>
            {d.photoUrl && (
              <div className="mt-3 flex items-start gap-2">
                <img src={d.photoUrl} alt={plan.label} className="h-40 min-w-0 flex-1 rounded-xl border border-border object-contain" />
                <button type="button" aria-label="Odstrani sliko" onClick={() => update(plan.id, { photoUrl: "" })} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        )}

        <label className="block text-base font-semibold">Opomba (neobvezno)
          <textarea rows={2} value={d.note ?? ""} onChange={(e) => update(plan.id, { note: e.target.value })} className={`${fieldClass} min-h-16`} placeholder="Kaj še želite povedati zdravniku?" />
        </label>
      </section>

      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}

      <div className="flex gap-3 border-t pt-5">
        {step > 0 && (
          <button type="button" aria-label="Prejšnja meritev" onClick={() => { setStep(step - 1); setError(""); }}
            className="h-14 w-14 shrink-0 rounded-xl border border-border bg-card hover:bg-muted"><ArrowLeft className="mx-auto h-5 w-5" /></button>
        )}
        <button type="submit" disabled={saving} className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 whitespace-normal rounded-xl bg-primary px-5 text-lg font-bold text-white disabled:opacity-60">
          {step === steps.length - 1 ? <><Check className="h-5 w-5" />Zaključi meritve</> : <>Naprej<ArrowRight className="h-5 w-5" /></>}
        </button>
      </div>
      <History plans={plans} measurements={measurements} />
      <HowToMeasure entries={howTo} />
    </form>
  );
}

function HowToMeasure({ entries }: { entries: LibraryEntry[] }) {
  if (!entries.length) return null;
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-bold">Kako pravilno merim</summary>
      <div className="mt-4 space-y-4">
        {entries.map((e) => (
          <article key={e.id}>
            <h3 className="font-bold">{e.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{e.content}</p>
            {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary underline"><ExternalLink className="h-3.5 w-3.5" />Odpri dokument</a>}
          </article>
        ))}
      </div>
    </details>
  );
}

function measurementDisplay(m: Measurement): string {
  if (m.value !== null) return `${m.value}`;
  if (m.valueText) return m.valueText;
  if (m.photoUrl) return "Naložena slika";
  return "—";
}

function History({ plans, measurements }: { plans: Plan[]; measurements: Measurement[] }) {
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-bold">Zgodovina meritev</summary>
      <div className="mt-4 space-y-4">
        {plans.map((plan) => {
          const history = measurements.filter((m) => m.type === plan.type);
          const numeric = history.filter((m) => m.value !== null);
          return (
            <article key={plan.id} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-display text-lg font-semibold">{plan.label}</h3>
              {numeric.length > 0 && (
                <div className="mt-2 rounded-xl border border-border p-3">
                  <TrendChart compact points={numeric.map((m) => ({ id: m.id, value: m.value as number, recordedAt: String(m.recordedAt) }))} unit={plan.unit} thresholds={{ l1: plan.thresholdL1, l2: plan.thresholdL2, l3: plan.thresholdL3, lowL1: plan.thresholdLowL1, lowL2: plan.thresholdLowL2, lowL3: plan.thresholdLowL3 }} />
                </div>
              )}
              <div className="mt-3 space-y-1">
                {history.slice(0, 5).map((m) => (
                  <p key={m.id} className="text-sm text-muted-foreground">
                    {new Date(m.recordedAt).toLocaleString("sl-SI")} · {measurementDisplay(m)}{m.note ? ` · ${m.note}` : ""}
                    {m.photoUrl?.startsWith("/") && <img src={m.photoUrl} alt="Slika" className="mt-2 max-h-40 rounded-lg border border-border" />}
                  </p>
                ))}
                {history.length === 0 && <p className="text-sm text-muted-foreground">Še ni meritev.</p>}
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}

// --- Knjižnjica: okrevanje + vaje + zdravila + vnosi knjižnjice (po vzoru lovable) ---

function LibraryView({ diagnosis, dischargeDate, care, entries, plans, medications, onMedicationsChanged, assignments, onAcknowledge }: { diagnosis: string; dischargeDate: string; care: Care; entries: LibraryEntry[]; plans: Plan[]; medications: Medication[]; onMedicationsChanged: (v: Medication[]) => void; assignments: ExerciseAssignment[]; onAcknowledge: (id: string) => void }) {
  // Vnosi knjižnjice se porazdelijo po kategorijah v ustrezne razdelke (brez ločene sekcije "Knjižnjica")
  const careEntries = entries.filter((e) => e.category !== "VAJE" && e.category !== "MERITVE");
  const exerciseEntries = entries.filter((e) => e.category === "VAJE");
  const careRows: [string, string | null][] = [
    ["Normalni stranski učinki", care.sideEffects],
    ["Okviren potek okrevanja", care.timeline],
    ["Priporočila za prehrano", care.nutrition],
    ["Standardna priporočila", care.generalRecommendations],
    ["Potrebna oprema", care.equipment],
    ["Opozorilni simptomi — pokličite zdravnika", care.warningSymptoms],
    ["Rumeni alarm", care.alarmYellow],
    ["Rdeči alarm — takoj ukrepajte", care.alarmRed],
  ];
  return <div className="space-y-10 pt-2">
    <section aria-label="Okrvanje">
      <h2 className="font-display text-2xl">Okrvanje</h2>
      <p className="mt-1 text-xs text-muted-foreground">Načrt za stanje: <strong className="text-foreground">{diagnosis}</strong>{care.catalogSource ? <span> · vir: {care.catalogSource}</span> : null}</p>
      <p className="mt-1 text-xs text-muted-foreground">Odpust: {new Date(dischargeDate).toLocaleDateString("sl-SI")} · Naslednji vnosi: {plans.map((p) => `${p.label.toLowerCase()} (${p.frequency.toLowerCase()})`).join(", ") || "ni načrtovanih meritev"}</p>
      <div className="mt-2">
        {careRows.map(([label, value]) => value ? (
          <div key={label} className="border-b py-5">
            <h4 className="font-semibold">{label}</h4>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{value}</p>
          </div>
        ) : null)}
        {!careRows.some(([, v]) => v) && !careEntries.length && <p className="py-5 text-sm text-muted-foreground">Zdravnik še ni dodal priporočil.</p>}
        {careEntries.map((e) => (
          <div key={e.id} className="border-b py-5">
            <h4 className="font-semibold">{e.title}</h4>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{e.content}</p>
            {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary"><FileText className="h-3.5 w-3.5" />Odpri dokument</a>}
          </div>
        ))}
      </div>
    </section>

    <section aria-label="Vaje">
      <h2 className="font-display text-2xl">Tvoje vaje in navodila</h2>
      <p className="mt-2 text-base text-muted-foreground">Vaje izvajaj od datuma, ki ga je določil zdravnik, in po njegovih navodilih.</p>
      {!assignments.length && !care.exercises && <p className="mt-4 text-base text-muted-foreground">Zdravnik vam še ni dodelil sklopov vaj.</p>}
      <div className="mt-4 space-y-5">
        {assignments.map((a) => (
          <div key={a.id} className="space-y-3 border-b pb-5">
            <h4 className="break-words text-lg font-semibold">{a.exerciseSet.name}</h4>
            <p className="text-base font-semibold text-primary">Začetek vaj: {a.startDate || "datum še ni določen — počakaj na zdravnikova navodila"}{a.acknowledgedDate ? ` · opomnik potrjen ${a.acknowledgedDate}` : ""}</p>
            {a.exerciseSet.instructions && <p className="whitespace-pre-wrap break-words text-base">{a.exerciseSet.instructions}</p>}
            <GuideLinks set={a.exerciseSet} />
            {a.startDate && a.startDate <= todayKey() && a.acknowledgedDate !== a.startDate && (
              <button type="button" onClick={() => onAcknowledge(a.id)} className="flex items-center gap-1 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary"><Check className="h-3.5 w-3.5" />Potrdi prejem opomnika</button>
            )}
          </div>
        ))}
      </div>
      {care.exercises && (
        <div className="mt-4">
          <h4 className="font-semibold">Individualna navodila za vaje</h4>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{care.exercises}</p>
        </div>
      )}
      {exerciseEntries.map((e) => (
        <div key={e.id} className="mt-4 border-l-2 border-primary pl-4">
          <h4 className="font-semibold">{e.title}</h4>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{e.content}</p>
          {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary"><FileText className="h-3.5 w-3.5" />Odpri dokument</a>}
        </div>
      ))}
    </section>

    <section aria-label="Zdravila">
      <h2 className="font-display text-2xl">Zdravila</h2>
      <MedicationSchedule medications={medications} onChanged={onMedicationsChanged} />
    </section>
  </div>;
}
function safeTimes(value: string) { try { return JSON.parse(value) as string[]; } catch { return [value]; } }
function safeSlots(value: string) { try { const p = JSON.parse(value); return Array.isArray(p) ? p.filter((x) => typeof x === "string") as string[] : []; } catch { return []; } }
function MedicationSchedule({ medications, onChanged }: { medications: Medication[]; onChanged: (v: Medication[]) => void }) {
  const today = new Date(); const todayStr = todayKey();
  const rows = medications.flatMap((m) => safeTimes(m.times).map((time) => ({ m, time })));
  async function toggle(m: Medication, time: string) {
    const res = await fetch("/api/medications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ medicationId: m.id, time }) });
    if (res.ok) { const u = await res.json(); onChanged(medications.map((x) => x.id === m.id ? { ...x, takenSlots: u.takenSlots } : x)); }
  }
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">Zdravila niso vpisana.</p>;
  return <div className="mt-3 space-y-3">
    <p className="text-sm text-muted-foreground">{today.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" })}</p>
    {rows.sort((a, b) => a.time.localeCompare(b.time)).map(({ m, time }) => { const taken = safeSlots(m.takenSlots).includes(`${todayStr} ${time}`); return <label key={`${m.id}-${time}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><span><strong>{time}</strong> · {m.name} · {m.dosage}</span><input type="checkbox" checked={taken} onChange={() => toggle(m, time)} className="h-5 w-5 accent-primary" /></label>; })}
  </div>;
}
function Ai({ messages, text, onText, onSend, loading }: { messages: ChatMessage[]; text: string; onText: (v: string) => void; onSend: () => void; loading: boolean }) {
  return <Card title="AI asistent"><p className="mb-3 text-sm text-amber-700">Odgovori asistenta so informativni in niso zdravstveni nasvet. V nujnih primerih pokličite 112.</p><div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{messages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-xl p-3 ${m.sender === "PACIENT" ? "ml-auto bg-secondary" : "bg-muted"}`}><p className="text-sm">{m.text}</p><p className="mt-1 text-xs text-muted-foreground">{m.sender === "ASISTENT" ? "AI asistent" : "Jaz"} · {new Date(m.createdAt).toLocaleString("sl-SI")}</p></div>)}{loading && <div className="max-w-[80%] rounded-xl bg-muted p-3"><p className="text-sm text-muted-foreground">AI asistent razmišlja…</p></div>}</div><div className="flex gap-2"><input value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-3" placeholder="Vprašajte AI asistenta…" /><button type="button" onClick={onSend} disabled={loading} className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-60">Pošlji</button></div></Card>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>{children}</section>; }
