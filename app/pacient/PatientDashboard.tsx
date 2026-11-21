"use client";

import { useMemo, useState } from "react";

type Tab = "pregled" | "meritve" | "knjiznica" | "zdravila" | "chat" | "ai";

type Plan = { id: string; type: string; label: string; unit: string; frequency: string; thresholdL1: number | null; thresholdL2: number | null; thresholdL3: number | null };
type Measurement = { id: string; type: string; value: number | null; note: string | null; photoUrl: string | null; recordedAt: string | Date };
type LibraryEntry = { id: string; category: string; title: string; content: string };
type Medication = { id: string; name: string; dosage: string; times: string; takenAt: string | Date | null };
type ChatMessage = { id: string; sender: string; text: string; createdAt: string | Date };

export default function PatientDashboard(props: {
  patientName: string;
  diagnosis: string;
  dischargeDate: string;
  plans: Plan[];
  measurements: Measurement[];
  libraryEntries: LibraryEntry[];
  medications: Medication[];
  chatMessages: ChatMessage[];
}) {
  const [tab, setTab] = useState<Tab>("pregled");
  const [measurements, setMeasurements] = useState(props.measurements);
  const [chatMessages, setChatMessages] = useState(props.chatMessages);
  const [chatText, setChatText] = useState("");
  const [aiMessages, setAiMessages] = useState<{ sender: "JAZ" | "AI"; text: string }[]>([
    { sender: "AI", text: "Pozdravljeni. Sem osnovni AI pomočnik. Kako vam lahko pomagam?" },
  ]);
  const [aiText, setAiText] = useState("");
  const [medications, setMedications] = useState(props.medications);

  const tabs: { id: Tab; label: string }[] = [
    { id: "pregled", label: "Pregled" },
    { id: "meritve", label: "Meritve" },
    { id: "knjiznica", label: "Knjižnjica" },
    { id: "zdravila", label: "Zdravila" },
    { id: "chat", label: "Zdravnik" },
    { id: "ai", label: "AI asistent" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm text-slate-500">Pot okrevanja</p>
          <h1 className="text-3xl font-bold text-slate-900">Pozdravljen, {props.patientName}</h1>
        </header>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-sm" aria-label="Odseki">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "pregled" && (
          <section className="grid gap-4 md:grid-cols-2">
            <Card title="Vaša diagnoza"><p>{props.diagnosis}</p></Card>
            <Card title="Odpuščanje iz bolnišnice"><p>{new Date(props.dischargeDate).toLocaleDateString("sl-SI")}</p></Card>
            <Card title="Naslednje meritve">
              <div className="space-y-2">{props.plans.map((plan) => <p key={plan.id} className="flex justify-between"><span>{plan.label}</span><span className="text-slate-500">{plan.frequency}</span></p>)}</div>
            </Card>
            <Card title="Današnja zdravila">
              <MedicationSummary medications={medications} />
            </Card>
          </section>
        )}

        {tab === "meritve" && <Measurements plans={props.plans} measurements={measurements} onSaved={(item) => setMeasurements((old) => [item, ...old])} />}
        {tab === "knjiznica" && <Library entries={props.libraryEntries} />}
        {tab === "zdravila" && <MedicationCalendar medications={medications} onChanged={setMedications} />}
        {tab === "chat" && (
          <Chat
            messages={chatMessages}
            text={chatText}
            onText={setChatText}
            onSent={async () => {
              if (!chatText.trim()) return;
              const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", text: chatText }) });
              if (res.ok) {
                const message = await res.json();
                setChatMessages((old) => [...old, message]);
                setChatText("");
              }
            }}
          />
        )}
        {tab === "ai" && (
          <AiAssistant
            messages={aiMessages}
            text={aiText}
            onText={setAiText}
            onSend={() => {
              if (!aiText.trim()) return;
              setAiMessages((old) => [...old, { sender: "JAZ", text: aiText }, { sender: "AI", text: "To je demonstracija. Podrobnejši AI odgovor bo dodan kasneje. Za nujne ali nenavadne zdravstvene težave se obrnite na zdravnika." }]);
              setAiText("");
            }}
          />
        )}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>{children}</section>;
}

function Measurements({ plans, measurements, onSaved }: { plans: Plan[]; measurements: Measurement[]; onSaved: (item: Measurement) => void }) {
  return <section className="space-y-4">
    {plans.map((plan) => {
      const history = measurements.filter((item) => item.type === plan.type).slice(0, 3);
      return <MeasurementCard key={plan.id} plan={plan} history={history} onSaved={onSaved} />;
    })}
  </section>;
}

function MeasurementCard({ plan, history, onSaved }: { plan: Plan; history: Measurement[]; onSaved: (item: Measurement) => void }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState("");

  async function uploadPhoto(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setStatus("Dovoljene so le slike JPG, PNG ali WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setStatus("Slika je večja od 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setPhotoUrl(String(reader.result)); setStatus("Slika je pripravljena za shranitev."); };
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setStatus("");
    const body = plan.type === "SLIKA_RANE" ? { type: plan.type, note, photoUrl } : { type: plan.type, value: Number(value), note, photoUrl: photoUrl || null };
    const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setStatus(data.error ?? "Shranjevanje ni uspelo"); return; }
    onSaved(data); setValue(""); setNote(""); setPhotoUrl(""); setStatus("Meritev je shranjena.");
  }

  return <article className="rounded-xl bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold">{plan.label}</h2><p className="text-sm text-slate-500">{plan.frequency}{plan.unit ? ` · ${plan.unit}` : ""}</p></div></div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      {plan.type !== "SLIKA_RANE" && <label className="text-sm font-semibold">Vrednost<input required type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder={plan.unit} /></label>}
      {plan.type === "SLIKA_RANE" && <label className="text-sm font-semibold">Slika<input required={!photoUrl} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} className="mt-1 w-full rounded-lg border p-2" /></label>}
      <label className="text-sm font-semibold sm:col-span-2">Opomba<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border p-2" /></label>
      <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white sm:col-span-3" type="submit">Shrani meritve</button>
    </form>
    {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
    {history.length > 0 && <div className="mt-4 border-t pt-3"><p className="mb-2 text-sm font-semibold">Zadnji vnosi</p>{history.map((item) => <p key={item.id} className="text-sm text-slate-600">{new Date(item.recordedAt).toLocaleString("sl-SI")} · {item.value ?? (item.photoUrl ? "Naložena slika" : "—")}{item.note ? ` · ${item.note}` : ""}</p>)}</div>}
  </article>;
}

function Library({ entries }: { entries: LibraryEntry[] }) {
  const categories = useMemo(() => Array.from(new Set(entries.map((entry) => entry.category))), [entries]);
  return <section className="grid gap-4 md:grid-cols-2">{categories.map((category) => <Card key={category} title={category.replaceAll("_", " ")}><div className="space-y-4">{entries.filter((entry) => entry.category === category).map((entry) => <article key={entry.id}><h3 className="font-bold">{entry.title}</h3><p className="mt-1 text-sm text-slate-600">{entry.content}</p></article>)}</div></Card>)}</section>;
}

function MedicationSummary({ medications }: { medications: Medication[] }) {
  return <div className="space-y-2">{medications.map((medication) => <p key={medication.id} className="flex justify-between"><span>{medication.name}</span><span className="text-slate-500">{JSON.parse(medication.times).join(" · ")}</span></p>)}</div>;
}

function MedicationCalendar({ medications, onChanged }: { medications: Medication[]; onChanged: (value: Medication[]) => void }) {
  const today = new Date();
  const rows = medications.flatMap((medication) => (JSON.parse(medication.times) as string[]).map((time) => ({ medication, time })));

  async function toggle(medication: Medication, time: string) {
    const scheduled = new Date(today); const [hours, minutes] = time.split(":").map(Number); scheduled.setHours(hours, minutes, 0, 0);
    const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "medication", medicationId: medication.id }) });
    if (!res.ok) return;
    const updated = await res.json();
    onChanged(medications.map((med) => med.id === medication.id ? { ...med, takenAt: updated.takenAt } : med));
  }

  function isTaken(medication: Medication, _time: string) {
    return Boolean(medication.takenAt && new Date(medication.takenAt).toDateString() === today.toDateString());
  }

  return <Card title={today.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" })}><div className="space-y-3">{rows.sort((a, b) => a.time.localeCompare(b.time)).map(({ medication, time }) => { const taken = isTaken(medication, time); return <label key={`${medication.id}-${time}`} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span><strong>{time}</strong> · {medication.name} · {medication.dosage}</span><input type="checkbox" checked={taken} onChange={() => toggle(medication, time)} className="h-5 w-5" /></label>; })}</div></Card>;
}

function Chat({ messages, text, onText, onSent }: { messages: ChatMessage[]; text: string; onText: (value: string) => void; onSent: () => void }) {
  return <Card title="Sporočila z zdravnikom"><div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{messages.map((message) => <div key={message.id} className={`max-w-[80%] rounded-lg p-3 ${message.sender === "PACIENT" ? "ml-auto bg-blue-100" : "bg-slate-100"}`}><p className="text-sm">{message.text}</p><p className="mt-1 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString("sl-SI")}</p></div>)}</div><div className="flex gap-2"><input value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSent()} className="flex-1 rounded-lg border px-3 py-2" placeholder="Napišite sporočilo…" /><button type="button" onClick={onSent} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Pošlji</button></div></Card>;
}

function AiAssistant({ messages, text, onText, onSend }: { messages: { sender: "JAZ" | "AI"; text: string }[]; text: string; onText: (value: string) => void; onSend: () => void }) {
  return <Card title="AI asistent"><p className="mb-3 text-sm text-amber-700">Demonstracijski UI — odgovori niso dejavni zdravstveni nasveti.</p><div className="mb-4 max-h-96 space-y-3 overflow-y-auto">{messages.map((message, index) => <div key={index} className={`max-w-[80%] rounded-lg p-3 ${message.sender === "JAZ" ? "ml-auto bg-blue-100" : "bg-slate-100"}`}><p className="text-sm">{message.text}</p></div>)}</div><div className="flex gap-2"><input value={text} onChange={(e) => onText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} className="flex-1 rounded-lg border px-3 py-2" placeholder="Vprašajte AI asistenta…" /><button type="button" onClick={onSend} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Pošlji</button></div></Card>;
}
