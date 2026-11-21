import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const alertRank: Record<string, number> = {
  IZOSTANEK_VNOSA: 4,
  SOS: 5,
  L3: 3,
  L2: 2,
  L1: 1,
};

export default async function ZdravnikPage({
  searchParams,
}: {
  searchParams: Promise<{ pacientId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ZDRAVNIK") redirect("/pacient");

  const { pacientId } = await searchParams;
  if (pacientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: pacientId },
      include: {
        user: true,
        plans: { orderBy: { label: "asc" } },
        measurements: { orderBy: { recordedAt: "desc" }, include: { plan: true } },
        alerts: { orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { measurement: true } },
        medications: true,
        chatMessages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!patient) notFound();

    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <Link href="/zdravnik" className="text-sm font-semibold text-blue-700">← Nazaj na seznam</Link>
          <header className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Podatki pacienta</p>
                <h1 className="text-3xl font-bold text-slate-900">{patient.user.name}</h1>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{patient.status}</span>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <DetailCard title="Diagnoza"><p>{patient.diagnosis}</p></DetailCard>
            <DetailCard title="Odpuščanje iz bolnišnice"><p>{patient.dischargeDate.toLocaleDateString("sl-SI")}</p></DetailCard>
            <DetailCard title="Kontaktna oseba"><p>{patient.contactName}</p><p className="text-slate-600">{patient.contactPhone}</p></DetailCard>
            <DetailCard title="Merilni načrti">
              {patient.plans.length ? <div className="space-y-2">{patient.plans.map((plan) => (
                <p key={plan.id} className="flex justify-between gap-3"><span>{plan.label}</span><span className="text-slate-500">{plan.frequency}</span></p>
              ))}</div> : <EmptyText />}
            </DetailCard>
          </section>

          <DetailCard title="Zadnje meritve">
            {patient.measurements.length ? <div className="space-y-2">{patient.measurements.slice(0, 30).map((measurement) => (
              <p key={measurement.id} className="text-sm">
                {measurement.recordedAt.toLocaleString("sl-SI")} · <strong>{measurement.type}</strong> · {measurement.value ?? (measurement.photoUrl ? "Naložena slika" : "—")}{measurement.note ? ` · ${measurement.note}` : ""}
              </p>
            ))}</div> : <EmptyText />}
          </DetailCard>

          <DetailCard title="Alarmi">
            {patient.alerts.length ? <div className="space-y-2">{patient.alerts.map((alert) => (
              <article key={alert.id} className="rounded-lg border p-3">
                <p><strong>{alert.severity}</strong> · {alert.status}</p>
                <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                <p className="mt-1 text-xs text-slate-500">{alert.createdAt.toLocaleString("sl-SI")}</p>
              </article>
            ))}</div> : <EmptyText />}
          </DetailCard>

          <section className="grid gap-4 md:grid-cols-2">
            <DetailCard title="Zdravila">
              {patient.medications.length ? <div className="space-y-2">{patient.medications.map((medication) => (
                <p key={medication.id} className="text-sm"><strong>{medication.name}</strong> · {medication.dosage} · {JSON.parse(medication.times).join(" · ")}</p>
              ))}</div> : <EmptyText />}
            </DetailCard>
            <DetailCard title="Chat z pacientom">
              {patient.chatMessages.length ? <div className="max-h-96 space-y-2 overflow-y-auto">{patient.chatMessages.map((message) => (
                <p key={message.id} className="rounded-lg bg-slate-100 p-3 text-sm"><strong>{message.sender}</strong>: {message.text}<br /><span className="text-xs text-slate-500">{message.createdAt.toLocaleString("sl-SI")}</span></p>
              ))}</div> : <EmptyText />}
            </DetailCard>
          </section>
        </div>
      </main>
    );
  }

  const patients = await prisma.patient.findMany({
    include: {
      user: true,
      alerts: { where: { status: "ODPRT" }, orderBy: { createdAt: "desc" } },
      measurements: { orderBy: { recordedAt: "desc" }, take: 1 },
      chatMessages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const sortedPatients = [...patients].sort((a, b) => {
    const aSeverity = Math.max(0, ...a.alerts.map((alert) => alertRank[alert.severity] ?? 0));
    const bSeverity = Math.max(0, ...b.alerts.map((alert) => alertRank[alert.severity] ?? 0));
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;

    const aActivity = Math.max(
      a.measurements[0]?.recordedAt.getTime() ?? 0,
      a.chatMessages[0]?.createdAt.getTime() ?? 0,
      a.createdAt.getTime(),
    );
    const bActivity = Math.max(
      b.measurements[0]?.recordedAt.getTime() ?? 0,
      b.chatMessages[0]?.createdAt.getTime() ?? 0,
      b.createdAt.getTime(),
    );
    return bActivity - aActivity;
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm text-slate-500">Zdravniški pregled</p>
          <h1 className="text-3xl font-bold text-slate-900">Pacienti — {user.name}</h1>
        </header>

        {sortedPatients.length === 0 ? (
          <section className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">
            Trenutno ni evidentiranih pacientov.
          </section>
        ) : (
          <div className="grid gap-4">
            {sortedPatients.map((patient) => {
              const highestAlert = patient.alerts.reduce<(typeof patient.alerts)[number] | null>(
                (current, alert) =>
                  !current || (alertRank[alert.severity] ?? 0) > (alertRank[current.severity] ?? 0)
                    ? alert
                    : current,
                null,
              );
              const lastActivity = [
                patient.measurements[0]?.recordedAt,
                patient.chatMessages[0]?.createdAt,
              ]
                .filter((date): date is Date => Boolean(date))
                .sort((a, b) => b.getTime() - a.getTime())[0];

              return (
                <article key={patient.id} className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{patient.user.name}</h2>
                      <p className="mt-1 text-slate-600">{patient.diagnosis}</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{patient.status}</span>
                      {highestAlert && (
                        <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800">
                          {highestAlert.severity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4 text-sm text-slate-600">
                    <p>
                      {lastActivity
                        ? `Zadnja aktivnost: ${lastActivity.toLocaleString("sl-SI")}`
                        : "Ni evidentirane aktivnosti"}
                    </p>
                    <Link
                      href={`/zdravnik?pacientId=${patient.id}`}
                      className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                    >
                      Odpri podatke
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function EmptyText() {
  return <p className="text-sm text-slate-500">Ni podatkov.</p>;
}
