"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrendChart from "@/components/TrendChart";

type Plan = {
  id: string; type: string; label: string; unit: string; kind: string; frequency: string;
  thresholdL1: number | null; thresholdL2: number | null; thresholdL3: number | null;
  thresholdLowL1: number | null; thresholdLowL2: number | null; thresholdLowL3: number | null;
  baseline: string | null; baselineDate: string | null; customized: boolean;
  greenZone: string | null; yellowZone: string | null; redZone: string | null;
};
type Measurement = { id: string; type: string; value: number | null; valueText: string | null; note: string | null; photoUrl: string | null; author: string; severity: string | null; recordedAt: string };
type Alert = { id: string; severity: string; status: string; message: string; createdAt: string; measurementType: string | null };
type Medication = { id: string; name: string; dosage: string; times: string; duration: string | null; note: string | null; takenSlots: string };
type ChatMessage = { id: string; sender: string; text: string; createdAt: string };
type ExerciseSet = { id: string; name: string; condition: string; instructions: string; pdfUrl: string | null; sourceUrl: string | null; language: string; kind: string; pages: number | null };
type ExerciseAssignment = { id: string; exerciseSetId: string; startDate: string; acknowledgedDate: string | null; exerciseSet: ExerciseSet };
type LibraryEntry = { id: string; category: string; title: string; content: string; url: string | null; sourceUrl: string | null };
type Standard = { id: string; metricType: string; label: string; unit: string; thresholdL1: number | null; thresholdL2: number | null; thresholdL3: number | null; thresholdLowL1: number | null; thresholdLowL2: number | null; thresholdLowL3: number | null; greenZone: string | null; yellowZone: string | null; redZone: string | null };
type Patient = {
  id: string; status: string; diagnosis: string; dischargeDate: string; contactName: string; contactPhone: string;
  zzzs: string | null; sideEffects: string | null; timeline: string | null; nutrition: string | null; exercises: string | null;
  generalRecommendations: string | null; equipment: string | null; warningSymptoms: string | null;
  alarmYellow: string | null; alarmRed: string | null; catalogSource: string | null; careCustomized: boolean;
  name: string; email: string; latestActivity: string | null; highestAlert: string | null; lastSeverity: string | null;
  plans: Plan[]; measurements: Measurement[]; alerts: Alert[]; medications: Medication[]; chatMessages: ChatMessage[];
  exerciseAssignments: ExerciseAssignment[];
};
type CatalogCondition = {
  condition: string; metrics: { type: string; label: string; unit: string; kind: string }[];
  plans: (Plan & { id?: string })[]; equipment: string; exerciseSetIds: string[]; startGuidance: string;
  sideEffects: string; timeline: string; nutrition: string; recommendations: string; warningSymptoms: string;
  alarmYellow: string; alarmRed: string;
};
type CatalogResponse = { conditions: CatalogCondition[] };

const rank: Record<string, number> = { L1: 1, L2: 2, L3: 3, IZOSTANEK_VNOSA: 4, SOS: 5 };
const alertClass = (severity: string | null) => severity === "SOS" || severity === "L3" ? "bg-red-100 text-red-800" : severity === "L2" || severity === "IZOSTANEK_VNOSA" ? "bg-amber-100 text-amber-800" : "bg-secondary text-primary";
const severityLabel: Record<string, string> = { VARNO: "Varno", NENAVADNO: "Nenavadno", KRITICNO: "Kritično", NEOCENJENO: "Neocenjeno" };
const severityClass = (s: string | null) => !s ? "" : s === "KRITICNO" ? "bg-red-100 text-red-800" : s === "NENAVADNO" ? "bg-amber-100 text-amber-800" : s === "VARNO" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground";
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isOverdue = (p: Patient) => {
  if (!p.latestActivity) return true;
  return Date.now() - new Date(p.latestActivity).getTime() > 3 * 24 * 3600 * 1000;
};
const timeLabel = (iso: string | null) => {
  if (!iso) return "Še ni vnosa";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days >= 1) return days === 1 ? "Pred 1 dnevom" : days === 2 ? "Pred 2 dnevoma" : `Pred ${days} dnevi`;
  return `Danes, ${new Date(iso).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function DoctorDashboardLovable({ patients, userName, libraryEntries, exerciseSets, standards }: { patients: Patient[]; userName: string; libraryEntries: LibraryEntry[]; exerciseSets: ExerciseSet[]; standards: Standard[] }) {
  const router = useRouter();
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState(patients[0]?.id || ""); const [tab, setTab] = useState("metrics");
  const [showCreate, setShowCreate] = useState(false); const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [entryFor, setEntryFor] = useState<Patient | null>(null);
  const [hospitalFor, setHospitalFor] = useState<Patient | null>(null);
  const sorted = useMemo(() => [...patients].sort((a, b) => (rank[b.highestAlert || ""] || 0) - (rank[a.highestAlert || ""] || 0) || Number(isOverdue(b)) - Number(isOverdue(a)) || (new Date(b.latestActivity || 0).getTime() - new Date(a.latestActivity || 0).getTime())), [patients]);
  const shown = sorted.filter((p) => `${p.name} ${p.diagnosis}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "critical" && (p.highestAlert === "L3" || p.highestAlert === "SOS")) || (filter === "overdue" && (p.highestAlert === "IZOSTANEK_VNOSA" || isOverdue(p)))));
  const patient = patients.find((p) => p.id === selected) || shown[0];
  const critical = patients.filter((p) => p.highestAlert === "L3" || p.highestAlert === "SOS").length;
  const overdue = patients.filter((p) => p.highestAlert === "IZOSTANEK_VNOSA" || isOverdue(p)).length;
  return <>
    <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Zdravnikov pregled</p><h1 className="font-display text-4xl">Moji pacienti</h1><p className="mt-2 text-sm text-muted-foreground">Spremljanje stanja in okrevanja</p></div><button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">＋ Nov pacient</button></div>
    {createdCredentials && <div role="status" className="mb-5 rounded-xl border border-primary bg-card p-4"><p className="text-sm font-bold">Pacient je dodan</p><p className="mt-2 text-sm">E-pošta: <strong>{createdCredentials.email}</strong></p><p className="text-sm">Geslo (privzeto za vse paciente): <strong>{createdCredentials.password}</strong></p><button type="button" onClick={() => setCreatedCredentials(null)} className="mt-3 text-xs font-bold text-primary">Skrij</button></div>}
    {showCreate && <AddPatientModal onClose={() => setShowCreate(false)} onCreated={(c) => { setCreatedCredentials(c); setShowCreate(false); router.refresh(); }} />}
    <div className="mb-6 grid grid-cols-3 divide-x border-y py-4">{[["Vsi pacienti", patients.length, "all"], ["Kritično stanje", critical, "critical"], ["Brez vnosa ≥ 3 dni", overdue, "overdue"]].map(([label, count, value]) => <button key={String(value)} type="button" onClick={() => setFilter(String(value))} className="px-3 text-left"><strong className="block text-2xl text-primary">{count}</strong><span className="text-xs text-muted-foreground">{label}</span></button>)}</div>
    <div className="grid items-start gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4"><input aria-label="Poišči pacienta" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Poišči pacienta …" className="w-full rounded-xl border border-border bg-card px-4 py-3" /><div className="flex flex-wrap gap-1">{([["all", "Vsi"], ["critical", "Kritični"], ["overdue", "Brez vnosa"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === value ? "bg-secondary text-primary" : "text-muted-foreground"}`}>{label}</button>)}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{shown.map((p) => <button key={p.id} type="button" onClick={() => { setSelected(p.id); setTab("metrics"); }} className={`flex h-auto items-start gap-3 rounded-xl border p-4 text-left ${selected === p.id ? "border-primary bg-card" : "border-border bg-card"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{initials(p.name)}</span><span className="min-w-0 flex-1"><strong className="block">{p.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{p.diagnosis}</span><span className="mt-3 flex flex-wrap gap-2">{isOverdue(p) ? <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{timeLabel(p.latestActivity)}</span> : <span className={`rounded-md px-2 py-1 text-xs font-bold ${severityClass(p.lastSeverity)}`}>{severityLabel[p.lastSeverity ?? ""] ?? "Brez ocene"}</span>}{p.highestAlert && <span className={`rounded-md px-2 py-1 text-xs font-bold ${alertClass(p.highestAlert)}`}>{p.highestAlert}</span>}</span></span></button>)}</div>{!shown.length && <p className="py-5 text-sm text-muted-foreground">Ni pacientov za izbrani filter.</p>}<p className="hidden">{userName}</p></aside>
      {patient && <section className="min-w-0 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-3xl">{patient.name}</h2><p className="mt-1 text-sm text-muted-foreground">{patient.diagnosis}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{patient.status}</span></div>
        {isOverdue(patient) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><div><p className="text-sm font-bold text-amber-900">{patient.latestActivity ? "Vsaj 3 dni brez novih podatkov" : "Pacient še ni vpisal podatkov"}</p><p className="mt-1 text-xs text-amber-800">Čas je za opomnik pacientu.</p></div><a className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-900" href={`mailto:${patient.email}?subject=${encodeURIComponent("Opomnik za vnos podatkov — AdaHack2026")}&body=${encodeURIComponent(`Pozdravljeni, ${patient.name},\n\nprosimo, vnesite ${patient.latestActivity ? "nove" : "prve"} podatke o svojem počutju in meritvah.\n\nLep pozdrav,\n${userName}`)}`}>Pripravi opomnik (e-pošta)</a></div>}
        <nav className="mt-6 flex gap-1 overflow-x-auto border-b">{([["alerts", "Alarmi"], ["metrics", "Meritve"], ["care", "Okrevanje"], ["exercises", "Vaje"], ["history", "Zgodovina"], ["contacts", "Kontakti"], ["chat", "Klepet"], ["library", "Knjižnjica"], ["standards", "Standardi"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`px-3 py-3 text-sm font-bold ${tab === value ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{label}</button>)}</nav>
        {tab === "alerts" && <AlertsView patient={patient} />}
        {tab === "metrics" && <MetricView patient={patient} onEntry={() => setEntryFor(patient)} onHospital={() => setHospitalFor(patient)} />}
        {tab === "care" && <CareView patient={patient} />}
        {tab === "exercises" && <ExercisesView patient={patient} exerciseSets={exerciseSets} />}
        {tab === "history" && <HistoryView patient={patient} />}
        {tab === "contacts" && <ContactsView patient={patient} />}
        {tab === "chat" && <ChatView patient={patient} />}
        {tab === "library" && <LibraryView entries={libraryEntries} />}
        {tab === "standards" && <StandardsView standards={standards} />}
      </section>}
    </div>
    {entryFor && <ReadingEntryModal patient={entryFor} onClose={() => setEntryFor(null)} onSaved={() => { setEntryFor(null); router.refresh(); }} />}
    {hospitalFor && <HospitalDataModal patient={hospitalFor} onClose={() => setHospitalFor(null)} onSaved={() => { setHospitalFor(null); router.refresh(); }} />}
  </>;
}

function initials(name: string) { return name.split(" ").map((n) => n[0]).join(""); }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5"><h3 className="mb-3 font-bold">{title}</h3>{children}</section>; }
const field = "w-full rounded-xl border border-border bg-card px-3 py-3 text-sm";

function MetricView({ patient, onEntry, onHospital }: { patient: Patient; onEntry: () => void; onHospital: () => void }) {
  return <div className="pt-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4"><h3 className="font-semibold">Izhodišče pred odpustom in meritve</h3><div className="flex gap-2"><button type="button" onClick={onHospital} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Podatki iz bolnišnice</button><button type="button" onClick={onEntry} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">＋ Vpiši meritev</button></div></div>
    <div className="mb-4 grid gap-3 sm:grid-cols-2">{patient.plans.map((plan) => { const reading = patient.measurements.find((m) => m.type === plan.type); const series = patient.measurements.filter((m) => m.type === plan.type && m.value !== null); const zones = [plan.greenZone && `Zelena: ${plan.greenZone}`, plan.yellowZone && `Rumena: ${plan.yellowZone}`, plan.redZone && `Rdeča: ${plan.redZone}`].filter(Boolean).join(" · "); return <article key={plan.id} className="rounded-xl border border-border p-4"><h3 className="font-bold">{plan.label}</h3><p className="mt-3 text-2xl font-bold">{reading ? (reading.value !== null ? `${reading.value}${plan.unit ? ` ${plan.unit}` : ""}` : reading.valueText ?? (reading.photoUrl ? "Slika" : "—")) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{plan.frequency}{plan.baseline ? ` · izhodišče: ${plan.baseline}` : ""}</p>{zones && <p className="mt-1 text-xs text-muted-foreground">{zones}</p>}{reading?.severity && <span className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-bold ${severityClass(reading.severity)}`}>{severityLabel[reading.severity]}</span>}{(plan.kind === "NUMERIC" || plan.kind === "PRESSURE") && series.length > 0 && <div className="mt-3 border-t pt-2"><p className="mb-1 text-xs font-bold text-muted-foreground">Trend ({series.length} meritev)</p><TrendChart points={series.map((m) => ({ id: m.id, value: m.value as number, recordedAt: m.recordedAt }))} unit={plan.unit} thresholds={{ l1: plan.thresholdL1, l2: plan.thresholdL2, l3: plan.thresholdL3, lowL1: plan.thresholdLowL1, lowL2: plan.thresholdLowL2, lowL3: plan.thresholdLowL3 }} /></div>}</article>; })}</div>
    {!patient.plans.length && <p className="text-sm text-muted-foreground">Ni merilnih načrtov.</p>}
  </div>;
}

function CareView({ patient }: { patient: Patient }) {
  const rows: [string, string | null][] = [
    ["Normalni stranski učinki", patient.sideEffects], ["Okviren potek okrevanja", patient.timeline], ["Priporočila za prehrano", patient.nutrition],
    ["Standardna priporočila", patient.generalRecommendations], ["Potrebna oprema", patient.equipment],
    ["Opozorilni simptomi", patient.warningSymptoms], ["Rumeni alarm", patient.alarmYellow], ["Rdeči alarm", patient.alarmRed],
    ["Individualna navodila za vaje", patient.exercises],
  ];
  return <div className="grid gap-4 pt-5 sm:grid-cols-2">
    <Card title="Zdravila">{patient.medications.length ? <div className="space-y-2">{patient.medications.map((m) => { let times: string[] = []; try { times = JSON.parse(m.times); } catch { } return <p key={m.id} className="text-sm"><strong>{m.name}</strong> · {m.dosage}{m.duration ? ` · ${m.duration}` : ""}<br /><span className="text-muted-foreground">{times.join(" · ")}</span>{m.note ? <><br /><span className="text-muted-foreground">{m.note}</span></> : null}</p>; })}</div> : <p className="text-sm text-muted-foreground">Ni evidentiranih zdravil.</p>}</Card>
    <Card title="Načrt okrevanja"><p className="text-sm text-muted-foreground">Stanje: <strong className="text-foreground">{patient.diagnosis}</strong>{patient.catalogSource ? <span> · vir: {patient.catalogSource}</span> : null}</p><div className="mt-2 divide-y">{rows.map(([label, value]) => value ? <div key={label} className="py-2"><h4 className="text-xs font-bold">{label}</h4><p className="mt-1 whitespace-pre-wrap text-sm">{value}</p></div> : null)}{!rows.some(([, v]) => v) && <p className="py-2 text-sm text-muted-foreground">Ni priporočil.</p>}</div></Card>
  </div>;
}

function ExercisesView({ patient, exerciseSets }: { patient: Patient; exerciseSets: ExerciseSet[] }) {
  const router = useRouter();
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(patient.exerciseAssignments.map((a) => [a.exerciseSetId, a.startDate])));
  const [busy, setBusy] = useState("");
  async function toggle(setId: string, assign: boolean) {
    setBusy(setId);
    if (assign) {
      const startDate = dates[setId] || todayKey();
      const res = await fetch(`/api/patients/${patient.id}/exercises`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseSetId: setId, startDate }) });
      if (res.ok) router.refresh();
    } else {
      const res = await fetch(`/api/patients/${patient.id}/exercises`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseSetId: setId }) });
      if (res.ok) router.refresh();
    }
    setBusy("");
  }
  const assigned = new Set(patient.exerciseAssignments.map((a) => a.exerciseSetId));
  return <div className="space-y-3 pt-5">{exerciseSets.map((s) => { const isAssigned = assigned.has(s.id); const a = patient.exerciseAssignments.find((x) => x.exerciseSetId === s.id); return <article key={s.id} className={`rounded-xl border p-4 ${isAssigned ? "border-primary bg-card" : "border-border"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{s.name}</h3><p className="mt-1 text-xs text-muted-foreground">{s.kind === "exam" ? "Preiskava" : s.kind === "advice" ? "Priporočila" : "Vaje"}{s.pages ? ` · ${s.pages} str.` : ""}{s.condition ? ` · ${s.condition}` : ""}</p>{s.pdfUrl && <p className="mt-1"><a href={s.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary underline">PDF</a>{s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-muted-foreground underline">izvirni vir</a>}</p>}{a && <p className="mt-1 text-xs font-bold text-primary">Začetek: {a.startDate}{a.acknowledgedDate ? ` · potrjeno ${a.acknowledgedDate}` : ""}</p>}</div>
        <div className="flex items-center gap-2">{isAssigned && <input type="date" value={dates[s.id] ?? ""} onChange={(e) => setDates((d) => ({ ...d, [s.id]: e.target.value }))} className="rounded-lg border border-border px-2 py-1 text-xs" />}<button type="button" disabled={busy === s.id} onClick={() => toggle(s.id, !isAssigned)} className={`rounded-lg px-3 py-2 text-xs font-bold ${isAssigned ? "border border-red-300 text-red-700" : "bg-primary text-white"}`}>{isAssigned ? "Odstrani" : "Dodeli"}</button></div></div>{s.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{s.instructions}</p>}</article>; })}</div>;
}

function HistoryView({ patient }: { patient: Patient }) {
  return <div className="pt-5">{[...patient.measurements].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()).map((m) => <article key={m.id} className="border-b py-4"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{m.type}</strong><span className="text-sm text-muted-foreground">{new Date(m.recordedAt).toLocaleString("sl-SI")}</span></div><p className="mt-2 text-sm">{m.value !== null ? m.value : m.valueText ?? (m.photoUrl ? "Naložena slika" : "—")}{m.note ? ` · ${m.note}` : ""}</p>{m.photoUrl?.startsWith("/") && <img src={m.photoUrl} alt="Slika" className="mt-2 max-h-48 rounded-lg border border-border" />}<p className="mt-1 text-xs text-muted-foreground">{m.author === "ZDRAVNIK" ? "Zdravnik" : "Pacient"}{m.severity && <> · <span className={`rounded px-1 font-bold ${severityClass(m.severity)}`}>{severityLabel[m.severity]}</span></>}</p></article>)}{!patient.measurements.length && <p className="py-5 text-sm text-muted-foreground">Pacient še nima vnosov.</p>}</div>;
}

function ContactsView({ patient }: { patient: Patient }) {
  return <div className="space-y-4 pt-5"><Card title="Kontakt"><p><strong>{patient.contactName || "Ni vpisano"}</strong></p><p className="text-muted-foreground">{patient.contactPhone || "Ni vpisano"}</p></Card><Card title="E-pošta"><p className="break-all">{patient.email || "Ni vpisana"}</p></Card><Card title="ZZZS"><p>{patient.zzzs || "Ni vpisana"}</p></Card><Card title="Odpust iz bolnišnice"><p>{patient.dischargeDate ? new Date(patient.dischargeDate).toLocaleDateString("sl-SI") : "Ni vpisan"}</p></Card></div>;
}

// --- Vnos meritve zdravnika z oceno ---
function ReadingEntryModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState(patient.plans[0]?.type ?? "");
  const plan = patient.plans.find((p) => p.type === type);
  const kind = plan?.kind || "NUMERIC";
  const [value, setValue] = useState(""); const [sys, setSys] = useState(""); const [dia, setDia] = useState(""); const [text, setText] = useState(""); const [yesno, setYesno] = useState("");
  const [note, setNote] = useState(""); const [photoUrl, setPhotoUrl] = useState(""); const [severity, setSeverity] = useState<"VARNO" | "NENAVADNO" | "KRITICNO">("VARNO");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    let body: Record<string, unknown>;
    if (kind === "IMAGE") body = { patientId: patient.id, type, note, photoUrl, severity };
    else if (kind === "PRESSURE") body = { patientId: patient.id, type, valueText: `${sys}/${dia}`, note, severity };
    else if (kind === "YESNO") body = { patientId: patient.id, type, valueText: yesno, note, severity };
    else if (kind === "TEXT") body = { patientId: patient.id, type, valueText: text, note, severity };
    else body = { patientId: patient.id, type, value: Number(value), note, severity };
    const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Shranjevanje ni uspelo"); return; }
    onSaved();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
    <header className="flex items-start justify-between border-b px-6 py-5"><div><h2 className="font-display text-2xl">Vpiši meritev</h2><p className="mt-1 text-sm text-muted-foreground">{patient.name} · vnos zdravnika</p></div><button type="button" onClick={onClose} className="text-xl text-muted-foreground" aria-label="Zapri">×</button></header>
    <div className="space-y-4 overflow-y-auto px-6 py-5">
      <label className="block text-sm font-bold">Meritev<select value={type} onChange={(e) => setType(e.target.value)} className={`${field} mt-2`}>{patient.plans.map((p) => <option key={p.id} value={p.type}>{p.label}{p.unit ? ` (${p.unit})` : ""}</option>)}</select></label>
      {kind === "NUMERIC" && <label className="block text-sm font-bold">Vrednost{plan?.unit ? ` (${plan.unit})` : ""}<input type="number" step="any" required value={value} onChange={(e) => setValue(e.target.value)} className={`${field} mt-2`} /></label>}
      {kind === "PRESSURE" && <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Sistolični<input type="number" required value={sys} onChange={(e) => setSys(e.target.value)} className={`${field} mt-2`} placeholder="120" /></label><label className="block text-sm font-bold">Diastolični<input type="number" required value={dia} onChange={(e) => setDia(e.target.value)} className={`${field} mt-2`} placeholder="80" /></label></div>}
      {kind === "YESNO" && <label className="block text-sm font-bold">Odgovor<select required value={yesno} onChange={(e) => setYesno(e.target.value)} className={`${field} mt-2`}><option value="">Izberite…</option><option value="Ja">Ja</option><option value="Ne">Ne</option></select></label>}
      {kind === "TEXT" && <label className="block text-sm font-bold">Opis<input required value={text} onChange={(e) => setText(e.target.value)} className={`${field} mt-2`} /></label>}
      {kind === "IMAGE" && <label className="block text-sm font-bold">Slika<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); const up = await fetch("/api/upload", { method: "POST", body: fd }); const u = await up.json(); if (up.ok) setPhotoUrl(u.url); }} className={`${field} mt-2`} /></label>}
      <label className="block text-sm font-bold">Opomba<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-2`} /></label>
      <fieldset><legend className="mb-2 text-sm font-bold">Ocena zdravnika</legend><div className="grid grid-cols-3 gap-2">{(["VARNO", "NENAVADNO", "KRITICNO"] as const).map((s) => <label key={s} className={`cursor-pointer rounded-md border p-2 text-center text-sm ${severity === s ? "border-primary bg-secondary font-bold" : ""}`}><input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} className="mr-1 accent-primary" />{severityLabel[s]}</label>)}</div></fieldset>
      {plan && (plan.greenZone || plan.yellowZone || plan.redZone) && <div className="space-y-1 border-t pt-3 text-sm"><p className="font-bold">Določena območja</p><p>Zelena: {plan.greenZone || "ni določeno"}</p><p>Rumena: {plan.yellowZone || "ni določeno"}</p><p className="text-red-700">Rdeča: {plan.redZone || "ni določeno"}</p></div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-bold">Prekliči</button><button type="submit" disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Dodaj meritev</button></footer>
  </form></div>;
}

// --- Bolnišnični podatki (izhodišča) ---
function HospitalDataModal({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState(patient.plans.map((p) => ({ id: p.id, baseline: p.baseline ?? "", baselineDate: p.baselineDate ? p.baselineDate.slice(0, 10) : "" })));
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const plans = patient.plans.map((p) => { const r = rows.find((x) => x.id === p.id)!; return { ...p, baseline: r.baseline, baselineDate: r.baselineDate }; });
    const res = await fetch(`/api/patients/${patient.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plans }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || "Shranjevanje ni uspelo"); return; }
    onSaved();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
    <header className="flex items-start justify-between border-b px-6 py-5"><div><h2 className="font-display text-2xl">Podatki iz bolnišnice</h2><p className="mt-1 text-sm text-muted-foreground">{patient.name} · izhodiščne meritve pred odpustom</p></div><button type="button" onClick={onClose} className="text-xl text-muted-foreground" aria-label="Zapri">×</button></header>
    <div className="space-y-4 overflow-y-auto px-6 py-5">{patient.plans.map((p, i) => <fieldset key={p.id} className="space-y-2 border-b pb-4"><legend className="mb-1 font-bold">{p.label}</legend><label className="block text-sm">Meritev v bolnici pred odpustom<input value={rows[i]?.baseline ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, baseline: e.target.value } : x))} className={`${field} mt-1`} placeholder={p.unit} /></label><label className="block text-sm">Datum izhodiščne meritve<input type="date" value={rows[i]?.baselineDate ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, baselineDate: e.target.value } : x))} className={`${field} mt-1`} /></label></fieldset>)}</div>
    <footer className="flex justify-end gap-2 border-t px-6 py-4">{error && <p role="alert" className="mr-auto text-sm text-red-700">{error}</p>}<button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-bold">Prekliči</button><button type="submit" disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Shrani</button></footer>
  </form></div>;
}

// --- Nov pacient s katalogom stanj ---
type MetricDraft = { type: string; label: string; unit: string; kind: string; frequency: string; baseline: string; baselineDate: string; customized: boolean; greenZone: string; yellowZone: string; redZone: string; thresholdL2?: number | null; thresholdL3?: number | null; thresholdLowL2?: number | null; thresholdLowL3?: number | null };
type MedicationDraft = { name: string; dosage: string; times: string; duration: string; note: string };
const metricOptions = [
  { type: "POCUTJE", label: "Počutje", unit: "", kind: "TEXT" },
  { type: "BOLECINA", label: "Bolečina", unit: "/10", kind: "NUMERIC" },
  { type: "UTRIP", label: "Povprečen utrip", unit: "ut/min", kind: "NUMERIC" },
  { type: "PRITISK", label: "Krvni pritisk", unit: "mmHg", kind: "PRESSURE" },
  { type: "SLADKOR", label: "Sladkor", unit: "mmol/L", kind: "NUMERIC" },
  { type: "KISIK", label: "Kisik (SpO2)", unit: "%", kind: "NUMERIC" },
  { type: "TEZA", label: "Teža", unit: "kg", kind: "NUMERIC" },
  { type: "TEMPERATURA", label: "Temperatura", unit: "°C", kind: "NUMERIC" },
  { type: "PLJUCNA_KAPACITETA", label: "Pljučna kapaciteta", unit: "L", kind: "NUMERIC" },
  { type: "RESP_FREKVENCA", label: "Frekvenca dihanja", unit: "vdihov/min", kind: "NUMERIC" },
  { type: "GIBLJIVOST", label: "Gibljivost", unit: "", kind: "TEXT" },
  { type: "EDEM", label: "Edemi / otekanje", unit: "", kind: "TEXT" },
  { type: "KASELJ", label: "Kašelj", unit: "", kind: "YESNO" },
  { type: "BLATO", label: "Blato", unit: "", kind: "TEXT" },
  { type: "OKORELOST", label: "Okorelost", unit: "", kind: "TEXT" },
  { type: "KRVITEV", label: "Krvavitev", unit: "", kind: "YESNO" },
  { type: "PADCI", label: "Padci", unit: "", kind: "YESNO" },
  { type: "EKG", label: "EKG", unit: "", kind: "IMAGE" },
  { type: "SLIKA_RANE", label: "Slika rane / šiva", unit: "", kind: "IMAGE" },
];
function AddPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { email: string; password: string }) => void }) {
  const [tab, setTab] = useState("profile"); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [zzzs, setZzzs] = useState(""); const [diagnosis, setDiagnosis] = useState(""); const [dischargeDate, setDischargeDate] = useState(""); const [contactName, setContactName] = useState(""); const [contactPhone, setContactPhone] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogPick, setCatalogPick] = useState("");
  const [metrics, setMetrics] = useState<MetricDraft[]>([]); const [medications, setMedications] = useState<MedicationDraft[]>([]);
  const [sideEffects, setSideEffects] = useState(""); const [timeline, setTimeline] = useState(""); const [nutrition, setNutrition] = useState(""); const [exercises, setExercises] = useState("");
  useEffect(() => { fetch("/api/catalog").then((r) => r.json()).then(setCatalog).catch(() => { }); }, []);
  function pickCondition(condition: string) {
    setCatalogPick(condition);
    const c = catalog?.conditions.find((x) => x.condition === condition);
    if (!c) { setDiagnosis(condition); return; }
    setDiagnosis(c.condition);
    setMetrics(c.plans.map((p) => ({ type: p.type, label: p.label, unit: p.unit, kind: p.kind, frequency: p.frequency, baseline: "", baselineDate: "", customized: false, greenZone: p.greenZone ?? "", yellowZone: p.yellowZone ?? "", redZone: p.redZone ?? "", thresholdL2: p.thresholdL2 ?? null, thresholdL3: p.thresholdL3 ?? null, thresholdLowL2: p.thresholdLowL2 ?? null, thresholdLowL3: p.thresholdLowL3 ?? null })));
    setSideEffects(c.sideEffects); setTimeline(c.timeline); setNutrition(c.nutrition);
  }
  function toggleMetric(option: (typeof metricOptions)[number]) {
    setCatalogPick("");
    setMetrics((current) => current.some((m) => m.type === option.type) ? current.filter((m) => m.type !== option.type) : [...current, { type: option.type, label: option.label, unit: option.unit, kind: option.kind, frequency: "Po navodilu", baseline: "", baselineDate: "", customized: false, greenZone: "", yellowZone: "", redZone: "" }]);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!name.trim() || !diagnosis.trim()) { setError("Ime in diagnoza sta obvezna."); setTab("profile"); return; }
    try {
      const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, zzzs, diagnosis, dischargeDate, contactName, contactPhone, metrics, medications: medications.map((m) => ({ ...m, times: m.times.split(/[,; ]+/).map((v) => v.trim()).filter(Boolean) })), sideEffects, timeline, nutrition, exercises }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Dodajanje pacienta ni uspelo"); return; }
      onCreated({ email: data.email, password: data.password });
    } catch { setError("Dodajanje pacienta ni uspelo."); }
  }
  const picked = catalog?.conditions.find((c) => c.condition === catalogPick);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
    <header className="flex items-start justify-between border-b px-6 py-5"><div><h2 className="font-display text-2xl">Nov pacient</h2><p className="mt-1 text-sm text-muted-foreground">Podatki pacienta in načrt spremljanja</p></div><button type="button" onClick={onClose} className="text-xl text-muted-foreground" aria-label="Zapri">×</button></header>
    <nav className="flex gap-1 overflow-x-auto border-b px-6">{[["profile", "Podatki"], ["metrics", "Meritve"], ["medications", "Zdravila"], ["care", "Okrevanje"]].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`px-3 py-3 text-sm font-bold ${tab === value ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{label}</button>)}</nav>
    <div className="overflow-y-auto px-6 py-5">
      <div className={tab === "profile" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
        <label className="block text-sm font-bold">Stanje iz kataloga (samodejna nastavitev)<select value={catalogPick} onChange={(e) => pickCondition(e.target.value)} className={`${field} mt-2`}><option value="">— ročni vnos diagnoze —</option>{catalog?.conditions.map((c) => <option key={c.condition} value={c.condition}>{c.condition}</option>)}</select></label>
        <label className="block text-sm font-bold">Diagnoza / stanje *<input value={diagnosis} onChange={(e) => { setDiagnosis(e.target.value); setCatalogPick(""); }} className={`${field} mt-2`} /></label>
        {picked && <p className="text-xs text-muted-foreground sm:col-span-2">Iz kataloga: {picked.metrics.length} meritev, {picked.exerciseSetIds.length} sklopov vaj, začetek vaj: {picked.startGuidance}{picked.equipment && picked.equipment !== "-" ? `, oprema: ${picked.equipment}` : ""}</p>}
        <label className="block text-sm font-bold">Ime in priimek *<input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">E-pošta<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${field} mt-2`} placeholder="pacient@example.com" /></label>
        <label className="block text-sm font-bold">ZZZS številka<input value={zzzs} onChange={(e) => setZzzs(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">Datum odpusta<input type="date" value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">Kontaktna oseba<input value={contactName} onChange={(e) => setContactName(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold sm:col-span-2">Telefon kontaktne osebe<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={`${field} mt-2`} /></label>
      </div>
      <div className={tab === "metrics" ? "space-y-4" : "hidden"}>
        <p className="text-sm text-muted-foreground">Izberite meritve za spremljanje (če je izbrano stanje iz kataloga, so že nastavljene).</p>
        <div className="grid gap-2 sm:grid-cols-2">{metricOptions.map((option) => { const enabled = metrics.some((m) => m.type === option.type); return <label key={option.type} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${enabled ? "border-primary bg-secondary" : "border-border"}`}><input type="checkbox" checked={enabled} onChange={() => toggleMetric(option)} />{option.label}</label>; })}</div>
        {metrics.map((metric, index) => <fieldset key={metric.type} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><legend className="px-2 text-sm font-bold">{metric.label}</legend><label className="text-sm">Izhodiščna vrednost<input value={metric.baseline} onChange={(e) => setMetrics((c) => c.map((m, i) => i === index ? { ...m, baseline: e.target.value } : m))} className={`${field} mt-1`} /></label><label className="text-sm">Datum izhodišča<input type="date" value={metric.baselineDate} onChange={(e) => setMetrics((c) => c.map((m, i) => i === index ? { ...m, baselineDate: e.target.value } : m))} className={`${field} mt-1`} /></label><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={metric.customized} onChange={(e) => setMetrics((c) => c.map((m, i) => i === index ? { ...m, customized: e.target.checked } : m))} />Prilagodi meje temu pacientu</label>{metric.customized && (["greenZone", "yellowZone", "redZone"] as const).map((key) => <label key={key} className="text-sm">{key === "greenZone" ? "Zelena" : key === "yellowZone" ? "Rumena" : "Rdeča"}<input value={metric[key]} onChange={(e) => setMetrics((c) => c.map((m, i) => i === index ? { ...m, [key]: e.target.value } : m))} className={`${field} mt-1`} /></label>)}
        </fieldset>)}
      </div>
      <div className={tab === "medications" ? "space-y-4" : "hidden"}>
        <button type="button" onClick={() => setMedications((c) => [...c, { name: "", dosage: "", times: "", duration: "", note: "" }])} className="rounded-xl border px-4 py-2 text-sm font-bold text-primary">＋ Dodaj zdravilo</button>
        {medications.map((medication, index) => <fieldset key={index} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><legend className="px-2 font-bold">Zdravilo {index + 1}</legend>{(["name", "dosage", "times", "duration", "note"] as const).map((key) => <label key={key} className="text-sm">{key === "name" ? "Ime" : key === "dosage" ? "Odmerek" : key === "times" ? "Časi (npr. 08:00,20:00)" : key === "duration" ? "Trajanje" : "Opomba"}<input value={medication[key]} onChange={(e) => setMedications((c) => c.map((m, i) => i === index ? { ...m, [key]: e.target.value } : m))} className={`${field} mt-1`} /></label>)}</fieldset>)}
      </div>
      <div className={tab === "care" ? "grid gap-4" : "hidden"}>
        <label className="block text-sm font-bold">Normalni stranski učinki<textarea rows={3} value={sideEffects} onChange={(e) => setSideEffects(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">Potek okrevanja<textarea rows={3} value={timeline} onChange={(e) => setTimeline(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">Prehrana<textarea rows={3} value={nutrition} onChange={(e) => setNutrition(e.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-sm font-bold">Individualna navodila za vaje<textarea rows={3} value={exercises} onChange={(e) => setExercises(e.target.value)} className={`${field} mt-2`} /></label>
      </div>
    </div>
    <footer className="border-t px-6 py-4">{error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-bold">Prekliči</button><button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Dodaj pacienta</button></div></footer>
  </form></div>;
}

// --- Knjižnjica (CRUD) ---
function LibraryView({ entries }: { entries: LibraryEntry[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("VAJE"); const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [url, setUrl] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [edit, setEdit] = useState({ title: "", content: "", url: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, title, content, url: url || undefined }) });
    if (res.ok) { setTitle(""); setContent(""); setUrl(""); router.refresh(); }
  }
  async function save(id: string) {
    const res = await fetch(`/api/library/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    if (res.ok) { setEditing(null); router.refresh(); }
  }
  async function remove(id: string) {
    if (!confirm("Izbrisem vnos iz knjižnjice?")) return;
    const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }
  return <div className="space-y-4 pt-5"><form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4"><select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>{["MERITVE", "PREHRANA", "VAJE", "POTEK_OKREVANJA"].map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Naslov" className={field} /><input value={content} onChange={(e) => setContent(e.target.value)} required placeholder="Vsebina" className={field} /><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (npr. /guides/sbng-002.pdf)" className={field} /><button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white sm:col-span-4 sm:w-auto">Dodaj v knjižnjico</button></form>
    <div className="space-y-2">{entries.map((e) => <article key={e.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{e.category.replaceAll("_", " ")}</span><h3 className="mt-1 font-bold">{e.title}</h3><p className="mt-1 text-sm text-muted-foreground">{e.content}</p>{e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-primary underline">Odpri dokument</a>}</div><div className="flex gap-2"><button type="button" onClick={() => { setEditing(e.id); setEdit({ title: e.title, content: e.content, url: e.url ?? "" }); }} className="rounded-lg border px-3 py-1 text-xs font-bold">Uredi</button><button type="button" onClick={() => remove(e.id)} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-bold text-red-700">Izbriši</button></div></div>
      {editing === e.id && <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-3"><input value={edit.title} onChange={(ev) => setEdit({ ...edit, title: ev.target.value })} className={field} /><input value={edit.content} onChange={(ev) => setEdit({ ...edit, content: ev.target.value })} className={field} /><input value={edit.url} onChange={(ev) => setEdit({ ...edit, url: ev.target.value })} placeholder="URL" className={field} /><button type="button" onClick={() => save(e.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white sm:col-span-3 sm:w-auto">Shrani</button></div>}
    </article>)}</div></div>;
}

// --- Standardne meje bolnice ---
function StandardsView({ standards }: { standards: Standard[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(standards.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);
  async function save(s: Standard) {
    setBusy(true);
    await fetch("/api/standards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setBusy(false); router.refresh();
  }
  return <div className="space-y-3 pt-5">{rows.map((s, i) => <article key={s.metricType} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{s.label} <span className="text-xs font-normal text-muted-foreground">({s.metricType}{s.unit ? ` · ${s.unit}` : ""})</span></h3><button type="button" disabled={busy} onClick={() => save(s)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">Shrani</button></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="text-xs">Zelena cona<input value={s.greenZone ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, greenZone: e.target.value } : x))} className={`${field} mt-1`} /></label><label className="text-xs">Rumena cona<input value={s.yellowZone ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, yellowZone: e.target.value } : x))} className={`${field} mt-1`} /></label><label className="text-xs">Rdeča cona<input value={s.redZone ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, redZone: e.target.value } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L1 zgornja<input type="number" step="any" value={s.thresholdL1 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdL1: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L2 zgornja<input type="number" step="any" value={s.thresholdL2 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdL2: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L3 zgornja<input type="number" step="any" value={s.thresholdL3 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdL3: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L1 spodnja<input type="number" step="any" value={s.thresholdLowL1 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdLowL1: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L2 spodnja<input type="number" step="any" value={s.thresholdLowL2 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdLowL2: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label><label className="text-xs">L3 spodnja<input type="number" step="any" value={s.thresholdLowL3 ?? ""} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, thresholdLowL3: e.target.value === "" ? null : Number(e.target.value) } : x))} className={`${field} mt-1`} /></label></div></article>)}</div>;
}

function AlertsView({ patient }: { patient: Patient }) {
  const router = useRouter();
  const sorted = [...patient.alerts].sort((a, b) => (a.status === b.status ? 0 : a.status === "ODPRT" ? -1 : 1) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  async function acknowledge(alertId: string) { const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "acknowledge", alertId }) }); if (res.ok) router.refresh(); }
  return <div className="space-y-3 pt-5">{sorted.length ? sorted.map((a) => <article key={a.id} className={`rounded-xl border p-4 ${a.status === "ODPRT" ? "border-primary bg-card" : "border-border bg-muted"}`}><div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-md px-2 py-1 text-xs font-bold ${alertClass(a.severity)}`}>{a.severity}</span><span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("sl-SI")}</span></div><p className="mt-2 text-sm">{a.message}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold">{a.status === "ODPRT" ? "Odprt" : "Potrjen"}</span>{a.status === "ODPRT" && <button type="button" onClick={() => acknowledge(a.id)} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Potrdi</button>}</div></article>) : <p className="py-5 text-sm text-muted-foreground">Ni alarmov.</p>}</div>;
}

function ChatView({ patient }: { patient: Patient }) {
  const router = useRouter(); const [text, setText] = useState("");
  async function send() { if (!text.trim()) return; const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim(), patientId: patient.id }) }); if (res.ok) { setText(""); router.refresh(); } }
  return <div className="pt-5"><Card title="Klepet s pacientom"><p className="mb-3 text-sm text-muted-foreground">Klepet ni namenjen nujnim primerom — ob nujnem stanju pacient pokliče 112.</p>{patient.chatMessages.length ? <div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{patient.chatMessages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-xl p-3 ${m.sender === "ZDRAVNIK" ? "ml-auto bg-secondary" : "bg-muted"}`}><p className="text-sm">{m.text}</p><p className="mt-1 text-xs text-muted-foreground">{m.sender === "ASISTENT" ? "AI asistent" : m.sender === "PACIENT" ? "Pacient" : "Zdravnik"} · {new Date(m.createdAt).toLocaleString("sl-SI")}</p></div>)}</div> : <p className="mb-4 text-sm text-muted-foreground">Ni sporočil.</p>}<div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} className="flex-1 rounded-lg border border-border px-3 py-3" placeholder="Odgovorite pacientu…" /><button type="button" onClick={send} className="rounded-lg bg-primary px-5 py-3 font-bold text-white">Pošlji</button></div></Card></div>;
}
