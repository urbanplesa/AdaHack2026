// Next.js instrumentation hook — ob zagonu nodejs strežnika zaženemo samodejni
// pregled izostalih vnosov meritev (alarm IZOSTANEK_VNOSA), glej lib/missed-checkins.ts.
// Interval: MISSED_CHECKINS_INTERVAL_MINUTES (privzeto 15 min, najmanj 1 s).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // dev-HMR lahko register() pokliče večkrat — en sam timer na proces
  const g = globalThis as unknown as { __adahackMissedCheckinsTimer?: ReturnType<typeof setInterval> };
  if (g.__adahackMissedCheckinsTimer) return;

  // dinamični import, da se Prisma ne naloži v edge/build fazi
  const { checkMissedCheckins } = await import("@/lib/missed-checkins");

  const minutes = Number(process.env.MISSED_CHECKINS_INTERVAL_MINUTES ?? "15");
  const intervalMs = Math.max(1000, (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60_000);

  const run = async () => {
    try {
      const result = await checkMissedCheckins();
      console.log(
        `[missed-checkins] pregledano=${result.checked} novih alarmov=${result.createdAlerts}` +
          (result.patientIds.length ? ` (${result.patientIds.join(", ")})` : "")
      );
    } catch (err) {
      console.error("[missed-checkins] napaka:", err);
    }
  };

  g.__adahackMissedCheckinsTimer = setInterval(run, intervalMs);
  g.__adahackMissedCheckinsTimer.unref?.();
  console.log(`[missed-checkins] samodejni pregled aktiven — vsakih ${intervalMs / 60_000} min (MISSED_CHECKINS_INTERVAL_MINUTES)`);
}
