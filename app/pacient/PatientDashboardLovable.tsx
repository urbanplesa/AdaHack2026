"use client";

import { useMemo, useState } from "react";
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

export default function PatientDashboardLovable(props: {
  patientName: string; diagnosis: string; dischargeDate: string; care: Care;
  plans: Plan[]; measurements: Measurement[]; libraryEntries: LibraryEntry[]; exerciseSets: ExerciseSet[];
  exerciseAssignments: ExerciseAssignment[]; medications: Medication[]; chatMessages: ChatMessage[]; alerts: PatientAlert[];
}) {
  const [tab, setTab] = useState("daily");
  const [measurements, setMeasurements] = useState(props.measurements);
  const [chatMessages, setChatMessages] = useState(props.chatMessages);
  const [chatText, setChatText] = useState("");
  const [medications, setMedications] = useState(props.medications);
  const [assignments, setAssignments] = useState(props.exerciseAssignments);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>(props.chatMessages.filter((m) => m.sender !== "ZDRAVNIK"));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [liveAlert, setLiveAlert] = useState<PatientAlert | null>(null);
  const tabs = [["daily", "Počutje"], ["alerts", "Alarmi"], ["care", "Moj načrt"], ["measurements", "Meritve"], ["library", "Knjižnjica"], ["medications", "Zdravila"], ["chat", "Klepet"], ["ai", "AI asistent"]] as const;

  // Alarmi: vsi (iz strežnika) + morebitni ravnokar sprožen (še ni v props)
  const allAlerts = useMemo(
    () => (liveAlert && !props.alerts.some((a) => a.id === liveAlert.id) ? [liveAlert, ...props.alerts] : props.alerts),
    [props.alerts, liveAlert],
  );
  const openAlerts = allAlerts.filter((a) => a.status === "ODPRT");
  const criticalAlerts = openAlerts.filter((a) => a.severity === "L3" || a.severity === "SOS");
  const warningAlerts = openAlerts.filter((a) => a.severity === "L2" || a.severity === "IZOSTANEK_VNOSA");
  function handleSaved(item: Measurement & { alert?: PatientAlert | null }) {
    setMeasurements((old) => [item, ...old]);
    if (item.alert) setLiveAlert(item.alert);
  }

  // Opomnik za vaje: sklopi s startDate <= danes, ki še niso potrjeni
  const dueExercises = useMemo(
    () => assignments.filter((a) => a.startDate && a.startDate <= todayKey() && a.acknowledgedDate !== a.startDate && (a.exerciseSet.kind === "exercise" || !a.exerciseSet.kind)),
    [assignments],
  );
  async function acknowledge(id: string) {
    const res = await fetch(`/api/exercise-assignments/${id}/acknowledge`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setAssignments((old) => old.map((a) => (a.id === id ? { ...a, acknowledgedDate: updated.acknowledgedDate } : a)));
    }
  }

  return <>
    <div className="mb-6 mt-3"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Pot okrevanja</p><h1 className="font-display text-4xl">Dober dan, {props.patientName.split(" ")[0]}</h1><p className="mt-2 text-muted-foreground">Kako se počutite danes?</p></div>
    {criticalAlerts.length > 0 && (
      <section aria-label="Kritični alarm" className="mb-6 rounded-2xl border border-red-400 bg-red-50 p-5">
        <h2 className="font-bold text-red-800">Kritično stanje — takoj pokličite 112</h2>
        {criticalAlerts.map((a) => <p key={a.id} className="mt-2 text-sm text-red-800">{a.message}</p>)}
      </section>
    )}
    {warningAlerts.length > 0 && (
      <section aria-label="Opozorilo o meritvi" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-900">Meritev izven varnega območja — zdravnik je obveščen</h2>
        {warningAlerts.map((a) => <p key={a.id} className="mt-2 text-sm text-amber-800">{a.message}</p>)}
      </section>
    )}
    {dueExercises.length > 0 && (
      <section aria-label="Opomnik za začetek vaj" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-900">Čas je za začetek vaj</h2>
        {dueExercises.map((a) => (
          <div key={a.id} className="mt-3 border-t border-amber-200 pt-3">
            <p className="text-sm font-bold">{a.exerciseSet.name}</p>
            <p className="mt-1 text-xs text-amber-800">Začetek po navodilu zdravnika: {a.startDate}</p>
            <GuideLinks set={a.exerciseSet} />
          </div>
        ))}
        <button type="button" onClick={() => dueExercises.forEach((a) => acknowledge(a.id))} className="mt-4 rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-900">Potrdi prejem opomnika</button>
      </section>
    )}
    <nav className="mb-7 flex gap-1 overflow-x-auto border-b" aria-label="Odseki pacienta">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`whitespace-nowrap px-4 py-3 text-sm font-bold ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{id === "alerts" && criticalAlerts.length > 0 ? `${label} (${criticalAlerts.length})` : label}</button>)}</nav>
    {tab === "daily" && <DailyView diagnosis={props.diagnosis} dischargeDate={props.dischargeDate} plans={props.plans} medications={medications} onAlert={setLiveAlert} />}
    {tab === "alerts" && <PatientAlertsView alerts={allAlerts} />}
    {tab === "care" && <CareView diagnosis={props.diagnosis} care={props.care} entries={props.libraryEntries} assignments={assignments} onAcknowledge={acknowledge} />}
    {tab === "measurements" && <Measurements plans={props.plans} measurements={measurements} onSaved={handleSaved} />}
    {tab === "library" && <Library entries={props.libraryEntries} guides={props.exerciseSets} />}
    {tab === "medications" && <MedicationCalendar medications={medications} onChanged={setMedications} />}
    {tab === "chat" && <Chat messages={chatMessages} text={chatText} onText={setChatText} onSent={async () => { if (!chatText.trim()) return; const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chatText }) }); if (res.ok) { const m = await res.json(); setChatMessages((old) => [...old, m]); setChatText(""); } }} />}
    {tab === "ai" && <Ai messages={aiMessages} text={aiText} onText={setAiText} loading={aiLoading} onSend={async () => { if (!aiText.trim() || aiLoading) return; const text = aiText.trim(); setAiText(""); setAiLoading(true); try { const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); if (res.ok) { const data = await res.json(); setAiMessages((old) => [...old, data.userMessage, data.assistantMessage]); } } finally { setAiLoading(false); } }} />}
  </>;
}

function GuideLinks({ set }: { set: ExerciseSet }) {
  if (!set.pdfUrl) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">SB Nova Gorica · {set.language === "sq" ? "albanščina" : "slovenščina"}{set.pages ? ` · ${set.pages} str.` : ""}{set.kind === "exam" ? " · preiskava" : set.kind === "advice" ? " · priporočila" : " · vaje"}</span>
    <a href={set.pdfUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary">PDF</a>
    {set.sourceUrl && <a href={set.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-muted-foreground underline" title="Izvirni dokument bolnišnice">izvirni vir</a>}
  </div>;
}

function DailyView({ diagnosis, dischargeDate, plans, medications, onAlert }: { diagnosis: string; dischargeDate: string; plans: Plan[]; medications: Medication[]; onAlert: (a: PatientAlert) => void }) {
  const [mood, setMood] = useState(3); const [pain, setPain] = useState(2); const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState("");
  const moods = ["Zelo slabo", "Slabo", "Normalno", "Dobro", "Odlično"];
  const moodEmoji = ["😣", "🙁", "😐", "🙂", "😄"];
  const options = ["Glavobol", "Utrujenost", "Vročina", "Kašelj", "Bolečine", "Slabost"];
  const hasPocutje = plans.some((p) => p.type === "POCUTJE");
  const hasBolecina = plans.some((p) => p.type === "BOLECINA");
  async function submit() {
    setError(""); setSent(false);
    try {
      if (hasPocutje) {
        const text = [moods[mood - 1], ...symptoms].join(", ") + (note.trim() ? ` — ${note.trim()}` : "");
        const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "POCUTJE", valueText: text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Napaka");
        if (data.alert) onAlert(data.alert);
      }
      if (hasBolecina) {
        const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "BOLECINA", value: pain }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Napaka");
        if (data.alert) onAlert(data.alert);
      }
      if (!hasPocutje && !hasBolecina && !note.trim()) { setError("Vnesite kaj o počutju."); return; }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shranjevanje ni uspelo");
    }
  }
  return <div className="grid gap-7 lg:grid-cols-[1fr_320px]"><section className="space-y-6 border-t pt-6"><Card title="Splošno počutje"><div className="mt-3 flex flex-wrap gap-3">{moodEmoji.map((m, i) => <button key={i} type="button" aria-label={`Počutje ${i + 1}: ${moods[i]}`} onClick={() => setMood(i + 1)} className={`h-14 w-14 rounded-xl text-3xl ${mood === i + 1 ? "bg-secondary ring-2 ring-primary" : "bg-muted"}`}>{m}</button>)}</div></Card><Card title={`Bolečina: ${pain}/10`}><input aria-label="Bolečina" type="range" min={0} max={10} value={pain} onChange={(e) => setPain(+e.target.value)} className="mt-3 w-full accent-primary" /></Card><Card title="Simptomi"><div className="mt-3 flex flex-wrap gap-2">{options.map((s) => <button key={s} type="button" onClick={() => setSymptoms((old) => old.includes(s) ? old.filter((x) => x !== s) : [...old, s])} className={`rounded-full border px-4 py-2 text-sm ${symptoms.includes(s) ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>{s}</button>)}</div></Card><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kaj še želite povedati zdravniku?" className="w-full rounded-xl border border-border bg-white p-4" /><button type="button" onClick={submit} className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-white">{sent ? "✓ Shranjeno — zdravnik že vidi" : "Shrani počutje"}</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</section><aside className="space-y-4"><Card title="Vaša diagnoza"><p>{diagnosis}</p></Card><Card title="Odpuščanje"><p>{new Date(dischargeDate).toLocaleDateString("sl-SI")}</p></Card><Card title="Naslednji vnosi"><div className="space-y-2">{plans.map((p) => <p key={p.id} className="flex justify-between gap-3 text-sm"><span>{p.label}</span><span className="text-muted-foreground">{p.frequency}</span></p>)}</div></Card><Card title="Današnja zdravila"><div className="space-y-2">{medications.map((m) => <p key={m.id} className="flex justify-between text-sm"><span>{m.name}</span><span className="text-muted-foreground">{safeTimes(m.times).join(" · ")}</span></p>)}</div></Card></aside></div>;
}

function CareView({ diagnosis, care, entries, assignments, onAcknowledge }: { diagnosis: string; care: Care; entries: LibraryEntry[]; assignments: ExerciseAssignment[]; onAcknowledge: (id: string) => void }) {
  const relevant = entries.filter((e) => e.category === "POTEK_OKREVANJA" || e.category === "VAJE");
  const rows: [string, string | null][] = [
    ["Normalni stranski učinki", care.sideEffects],
    ["Okviren potek okrevanja", care.timeline],
    ["Priporočila za prehrano", care.nutrition],
    ["Standardna priporočila", care.generalRecommendations],
    ["Potrebna oprema", care.equipment],
    ["Opozorilni simptomi — pokličite zdravnika", care.warningSymptoms],
    ["Rumeni alarm", care.alarmYellow],
    ["Rdeči alarm — takoj ukrepajte", care.alarmRed],
  ];
  return <div className="space-y-4 pt-5">
    <Card title="Načrt okrevanja">
      <p className="text-sm text-muted-foreground">Načrt za stanje: <strong className="text-foreground">{diagnosis}</strong>{care.catalogSource ? <span> · vir: {care.catalogSource}</span> : null}</p>
      <div className="mt-3 divide-y">
        {rows.map(([label, value]) => value ? <div key={label} className="py-3"><h4 className="text-sm font-bold">{label}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p></div> : null)}
        {!rows.some(([, v]) => v) && <p className="py-3 text-sm text-muted-foreground">Zdravnik še ni dodal priporočil.</p>}
      </div>
    </Card>
    <Card title="Predpisana zdravila in sklopi vaj">
      {!assignments.length && !care.exercises && <p className="text-sm text-muted-foreground">Zdravnik vam še ni dodelil sklopov vaj.</p>}
      {assignments.map((a) => <div key={a.id} className="mt-3 border-l-2 border-primary pl-4"><p className="font-bold">{a.exerciseSet.name}</p><p className="mt-1 text-xs text-muted-foreground">Začetek vaj: {a.startDate || "datum še ni določen"}{a.acknowledgedDate ? ` · opomnik potrjen ${a.acknowledgedDate}` : ""}</p>{a.exerciseSet.instructions && <p className="mt-1 whitespace-pre-wrap text-sm">{a.exerciseSet.instructions}</p>}<GuideLinks set={a.exerciseSet} />{a.startDate && a.startDate <= todayKey() && a.acknowledgedDate !== a.startDate && <button type="button" onClick={() => onAcknowledge(a.id)} className="mt-2 rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary">Potrdi prejem opomnika</button>}</div>)}
      {care.exercises && <div className="mt-4"><p className="text-sm font-bold">Individualna navodila za vaje</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{care.exercises}</p></div>}
    </Card>
    {relevant.map((e) => <Card key={e.id} title={e.title}><p className="text-sm text-muted-foreground">{e.content}</p>{e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary">Odpri dokument</a>}</Card>)}
  </div>;
}

function Measurements({ plans, measurements, onSaved }: { plans: Plan[]; measurements: Measurement[]; onSaved: (m: Measurement & { alert?: PatientAlert | null }) => void }) {
  return <div className="space-y-4">{plans.map((plan) => <MeasurementCard key={plan.id} plan={plan} history={measurements.filter((m) => m.type === plan.type)} onSaved={onSaved} />)}</div>;
}
function measurementDisplay(m: Measurement): string {
  if (m.value !== null) return `${m.value}`;
  if (m.valueText) return m.valueText;
  if (m.photoUrl) return "Naložena slika";
  return "—";
}
function MeasurementCard({ plan, history, onSaved }: { plan: Plan; history: Measurement[]; onSaved: (m: Measurement & { alert?: PatientAlert | null }) => void }) {
  const kind = plan.kind || "NUMERIC";
  const [value, setValue] = useState(""); const [sys, setSys] = useState(""); const [dia, setDia] = useState("");
  const [text, setText] = useState(""); const [yesno, setYesno] = useState(""); const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState(""); const [status, setStatus] = useState(""); const [savedAlert, setSavedAlert] = useState<PatientAlert | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let body: Record<string, unknown>;
    if (kind === "IMAGE") body = { type: plan.type, note, photoUrl };
    else if (kind === "PRESSURE") body = { type: plan.type, valueText: `${sys}/${dia}`, note };
    else if (kind === "YESNO") body = { type: plan.type, valueText: yesno, note };
    else if (kind === "TEXT") body = { type: plan.type, valueText: text, note };
    else body = { type: plan.type, value: Number(value), note };
    const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setStatus(data.error || "Shranjevanje ni uspelo"); setSavedAlert(null); return; }
    onSaved(data); setValue(""); setSys(""); setDia(""); setText(""); setYesno(""); setNote(""); setPhotoUrl("");
    setSavedAlert(data.alert ?? null);
    setStatus(data.alert ? "" : "Meritev je shranjena.");
  }
  const zones = [plan.greenZone && `Zelena: ${plan.greenZone}`, plan.yellowZone && `Rumena: ${plan.yellowZone}`, plan.redZone && `Rdeča: ${plan.redZone}`].filter(Boolean).join(" · ");
  const numericHistory = history.filter((m) => m.value !== null);
  return <article className="rounded-2xl border border-border bg-card p-5"><div className="mb-4"><h2 className="font-display text-xl">{plan.label}</h2><p className="text-sm text-muted-foreground">{plan.frequency}{plan.unit ? ` · ${plan.unit}` : ""}{plan.baseline ? ` · izhodišče: ${plan.baseline}` : ""}</p>{zones && <p className="mt-1 text-xs text-muted-foreground">{zones}</p>}</div>{(kind === "NUMERIC" || kind === "PRESSURE") && numericHistory.length > 0 && <div className="mb-4 rounded-xl border border-border p-3"><TrendChart compact points={numericHistory.map((m) => ({ id: m.id, value: m.value as number, recordedAt: String(m.recordedAt) }))} unit={plan.unit} thresholds={{ l1: plan.thresholdL1, l2: plan.thresholdL2, l3: plan.thresholdL3, lowL1: plan.thresholdLowL1, lowL2: plan.thresholdLowL2, lowL3: plan.thresholdLowL3 }} /></div>}<form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
    {kind === "NUMERIC" && <label className="text-sm font-bold">Vrednost<input required type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" placeholder={plan.unit} /></label>}
    {kind === "PRESSURE" && <><label className="text-sm font-bold">Sistolični<input required type="number" value={sys} onChange={(e) => setSys(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" placeholder="120" /></label><label className="text-sm font-bold">Diastolični<input required type="number" value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" placeholder="80" /></label></>}
    {kind === "YESNO" && <label className="text-sm font-bold">Odgovor<select required value={yesno} onChange={(e) => setYesno(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-3"><option value="">Izberite…</option><option value="Ja">Ja</option><option value="Ne">Ne</option></select></label>}
    {kind === "TEXT" && <label className="text-sm font-bold">Opis<input required type="text" value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" placeholder="Npr. dobro, malo utrujen" /></label>}
    {kind === "IMAGE" && <label className="text-sm font-bold">Slika<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setStatus("Nalagam sliko…"); const fd = new FormData(); fd.append("file", f); const up = await fetch("/api/upload", { method: "POST", body: fd }); const u = await up.json(); if (!up.ok) { setStatus(u.error || "Nalaganje ni uspelo"); return; } setPhotoUrl(u.url); setStatus("Slika naložena."); }} className="mt-1 w-full rounded-lg border border-border p-2" /></label>}
    <label className="text-sm font-bold sm:col-span-2">Opomba<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-border p-3" /></label>
    <button className="rounded-lg bg-primary px-4 py-3 font-bold text-white sm:col-span-3" type="submit">Shrani meritev</button></form>{status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}{savedAlert && <p role="alert" className={`mt-3 text-sm font-bold ${savedAlert.severity === "L3" || savedAlert.severity === "SOS" ? "text-red-700" : "text-amber-700"}`}>Alarm {savedAlert.severity}: {savedAlert.message}{savedAlert.severity === "L3" || savedAlert.severity === "SOS" ? " — takoj pokličite 112" : ""}</p>}{history.length > 0 && <div className="mt-4 border-t pt-3">{history.slice(0, 3).map((m) => <p key={m.id} className="text-sm text-muted-foreground">{new Date(m.recordedAt).toLocaleString("sl-SI")} · {measurementDisplay(m)}{m.note ? ` · ${m.note}` : ""}{m.photoUrl?.startsWith("/") && <img src={m.photoUrl} alt="Slika" className="mt-2 max-h-40 rounded-lg border border-border" />}</p>)}</div>}</article>;
}

function Library({ entries, guides }: { entries: LibraryEntry[]; guides: ExerciseSet[] }) {
  const categories = useMemo(() => Array.from(new Set(entries.map((e) => e.category))), [entries]);
  return <div className="grid gap-4 md:grid-cols-2">{categories.map((category) => <Card key={category} title={category.replaceAll("_", " ")}><div className="space-y-4">{entries.filter((e) => e.category === category).map((e) => <article key={e.id}><h3 className="font-bold">{e.title}</h3><p className="mt-1 text-sm text-muted-foreground">{e.content}</p>{e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-primary underline">Odpri dokument</a>}</article>)}</div></Card>)}
    <Card title="Vadbeni vodiči (PDF)"><div className="space-y-4">{guides.map((g) => <article key={g.id}><h3 className="text-sm font-bold">{g.name}</h3><GuideLinks set={g} /></article>)}</div></Card>
  </div>;
}
function safeTimes(value: string) { try { return JSON.parse(value) as string[]; } catch { return [value]; } }
function safeSlots(value: string) { try { const p = JSON.parse(value); return Array.isArray(p) ? p.filter((x) => typeof x === "string") as string[] : []; } catch { return []; } }
function MedicationCalendar({ medications, onChanged }: { medications: Medication[]; onChanged: (v: Medication[]) => void }) {
  const today = new Date(); const todayStr = todayKey();
  const rows = medications.flatMap((m) => safeTimes(m.times).map((time) => ({ m, time })));
  async function toggle(m: Medication, time: string) {
    const res = await fetch("/api/medications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ medicationId: m.id, time }) });
    if (res.ok) { const u = await res.json(); onChanged(medications.map((x) => x.id === m.id ? { ...x, takenSlots: u.takenSlots } : x)); }
  }
  return <Card title={today.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" })}><div className="mt-2 space-y-3">{rows.sort((a, b) => a.time.localeCompare(b.time)).map(({ m, time }) => { const taken = safeSlots(m.takenSlots).includes(`${todayStr} ${time}`); return <label key={`${m.id}-${time}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"><span><strong>{time}</strong> · {m.name} · {m.dosage}</span><input type="checkbox" checked={taken} onChange={() => toggle(m, time)} className="h-5 w-5 accent-primary" /></label>; })}</div></Card>;
}
function Chat({ messages, text, onText, onSent }: { messages: ChatMessage[]; text: string; onText: (v: string) => void; onSent: () => void }) {
  return <Card title="Sporočila z zdravnikom"><p className="mb-3 border-b pb-3 text-sm text-muted-foreground">Klepet ni namenjen nujnim primerom. Ob nujnem stanju pokličite 112.</p><div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{messages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-xl p-3 ${m.sender === "PACIENT" ? "ml-auto bg-secondary" : "bg-muted"}`}><p className="text-sm">{m.text}</p><p className="mt-1 text-xs text-muted-foreground">{m.sender === "ASISTENT" ? "AI asistent" : m.sender === "ZDRAVNIK" ? "Zdravnik" : "Jaz"} · {new Date(m.createdAt).toLocaleString("sl-SI")}</p></div>)}</div><div className="flex gap-2"><input value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSent()} className="flex-1 rounded-lg border border-border px-3 py-3" placeholder="Napišite sporočilo…" /><button type="button" onClick={onSent} className="rounded-lg bg-primary px-5 py-3 font-bold text-white">Pošlji</button></div></Card>;
}
function Ai({ messages, text, onText, onSend, loading }: { messages: ChatMessage[]; text: string; onText: (v: string) => void; onSend: () => void; loading: boolean }) {
  return <Card title="AI asistent"><p className="mb-3 text-sm text-amber-700">Odgovori asistenta so informativni in niso zdravstveni nasvet. V nujnih primerih pokličite 112.</p><div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{messages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-xl p-3 ${m.sender === "PACIENT" ? "ml-auto bg-secondary" : "bg-muted"}`}><p className="text-sm">{m.text}</p><p className="mt-1 text-xs text-muted-foreground">{m.sender === "ASISTENT" ? "AI asistent" : "Jaz"} · {new Date(m.createdAt).toLocaleString("sl-SI")}</p></div>)}{loading && <div className="max-w-[80%] rounded-xl bg-muted p-3"><p className="text-sm text-muted-foreground">AI asistent razmišlja…</p></div>}</div><div className="flex gap-2"><input value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} className="flex-1 rounded-lg border border-border px-3 py-3" placeholder="Vprašajte AI asistenta…" /><button type="button" onClick={onSend} disabled={loading} className="rounded-lg bg-primary px-5 py-3 font-bold text-white disabled:opacity-60">Pošlji</button></div></Card>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>{children}</section>; }

const alertChipClass = (severity: string) => severity === "SOS" || severity === "L3" ? "bg-red-100 text-red-800" : severity === "L2" || severity === "IZOSTANEK_VNOSA" ? "bg-amber-100 text-amber-800" : "bg-secondary text-primary";
function PatientAlertsView({ alerts }: { alerts: PatientAlert[] }) {
  const sorted = [...alerts].sort((a, b) => (a.status === b.status ? 0 : a.status === "ODPRT" ? -1 : 1) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  return <div className="space-y-3 pt-5">{sorted.length ? sorted.map((a) => <article key={a.id} className={`rounded-xl border p-4 ${a.status === "ODPRT" ? "border-primary bg-card" : "border-border bg-muted"}`}><div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-md px-2 py-1 text-xs font-bold ${alertChipClass(a.severity)}`}>{a.severity}</span><span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("sl-SI")}</span></div><p className="mt-2 text-sm">{a.message}</p>{a.measurementType && <p className="mt-1 text-xs text-muted-foreground">Meritev: {a.measurementType}</p>}<p className="mt-2 text-xs font-bold">{a.status === "ODPRT" ? "Odprt — zdravnik pregleduje" : "Potrjen s strani zdravnika"}</p>{(a.severity === "L3" || a.severity === "SOS") && a.status === "ODPRT" && <p className="mt-1 text-xs font-bold text-red-700">Nujno: pokličite 112.</p>}</article>) : <p className="py-5 text-sm text-muted-foreground">Še ni alarmov.</p>}</div>;
}
