"use client";

import { useState } from "react";

export default function SosButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function sos() {
    setState("sending");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sos" }),
      });
      setState(res.ok ? "sent" : "idle");
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={sos}
      disabled={state === "sending"}
      className="rounded-xl bg-destructive px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
    >
      {state === "sent" ? "SOS poslan — pokličite 112" : state === "sending" ? "Pošiljam…" : "SOS — nujno"}
    </button>
  );
}
