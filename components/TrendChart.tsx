"use client";

import { evaluateThresholds } from "@/lib/thresholds";

export type TrendPoint = { id?: string; value: number; recordedAt: string };
export type TrendThresholds = {
  l1?: number | null; l2?: number | null; l3?: number | null;
  lowL1?: number | null; lowL2?: number | null; lowL3?: number | null;
};

const COLOR = { l3: "#dc2626", l2: "#d97706", l1: "#ca8a04", ok: "#16a34a" };

function pointColor(t: TrendThresholds, value: number): string {
  const r = evaluateThresholds(
    {
      thresholdL1: t.l1 ?? null,
      thresholdL2: t.l2 ?? null,
      thresholdL3: t.l3 ?? null,
      thresholdLowL1: t.lowL1 ?? null,
      thresholdLowL2: t.lowL2 ?? null,
      thresholdLowL3: t.lowL3 ?? null,
    },
    value,
  );
  if (!r) return COLOR.ok;
  return r.severity === "L3" ? COLOR.l3 : r.severity === "L2" ? COLOR.l2 : COLOR.l1;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("sl-SI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtNum = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)).replace(".", ",");

// Črtni graf trenda numeričnih meritev (brez odvisnosti) z mejnimi črtami L1/L2/L3
// (zgornje in spodnje) in obarvanimi točkami glede na resnost prekoračitve.
export default function TrendChart({
  points,
  unit = "",
  thresholds = {},
  compact = false,
}: {
  points: TrendPoint[];
  unit?: string;
  thresholds?: TrendThresholds;
  compact?: boolean;
}) {
  const pts = [...points].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  if (!pts.length) return null;

  const W = 600;
  const H = compact ? 110 : 190;
  const padL = 36, padR = 52, padT = compact ? 6 : 12, padB = compact ? 14 : 18;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  const thEntries: Array<[number, string, string, boolean]> = [
    [thresholds.l3, "L3", COLOR.l3, false],
    [thresholds.l2, "L2", COLOR.l2, false],
    [thresholds.l1, "L1", COLOR.l1, false],
    [thresholds.lowL3, "sp. L3", COLOR.l3, true],
    [thresholds.lowL2, "sp. L2", COLOR.l2, true],
    [thresholds.lowL1, "sp. L1", COLOR.l1, true],
  ].filter((e): e is [number, string, string, boolean] => typeof e[0] === "number");

  const values = pts.map((p) => p.value);
  let min = Math.min(...values, ...thEntries.map((e) => e[0]));
  let max = Math.max(...values, ...thEntries.map((e) => e[0]));
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;

  const x = (i: number) =>
    padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * ih;

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const inDomain = (v: number) => v >= min && v <= max;

  const xLabels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <svg
      data-testid="trend-chart"
      data-points={pts.length}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Graf trenda: ${pts.length} meritev`}
    >
      {/* območja čez mejami */}
      {thEntries.filter((e) => !e[3] && inDomain(e[0])).map(([v, , c]) => (
        <rect key={`u${v}`} x={padL} y={padT} width={iw} height={Math.max(0, y(v) - padT)} fill={c} opacity={0.07} />
      ))}
      {thEntries.filter((e) => e[3] && inDomain(e[0])).map(([v, , c]) => (
        <rect key={`l${v}`} x={padL} y={y(v)} width={iw} height={Math.max(0, padT + ih - y(v))} fill={c} opacity={0.07} />
      ))}
      {/* meje */}
      {thEntries.filter((e) => inDomain(e[0])).map(([v, label, c, low]) => (
        <g key={`${low ? "low" : "up"}-${v}`}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={c} strokeWidth={low ? 1 : 1.5} strokeDasharray={low ? "2 3" : "5 3"} />
          <text x={W - padR + 4} y={y(v) + 3} fontSize={9} fill={c}>{`${label} ${fmtNum(v)}`}</text>
        </g>
      ))}
      {/* črta trenda */}
      {pts.length > 1 && <path d={line} fill="none" className="stroke-primary" strokeWidth={compact ? 1.5 : 2} />}
      {/* točke */}
      {pts.map((p, i) => {
        const sev = evaluateThresholds(
          {
            thresholdL1: thresholds.l1 ?? null,
            thresholdL2: thresholds.l2 ?? null,
            thresholdL3: thresholds.l3 ?? null,
            thresholdLowL1: thresholds.lowL1 ?? null,
            thresholdLowL2: thresholds.lowL2 ?? null,
            thresholdLowL3: thresholds.lowL3 ?? null,
          },
          p.value,
        );
        return (
          <circle key={p.id ?? i} cx={x(i)} cy={y(p.value)} r={compact ? 2.5 : 3.5} fill={pointColor(thresholds, p.value)} stroke="#fff" strokeWidth={1}>
            <title>{`${fmtNum(p.value)}${unit ? ` ${unit}` : ""} · ${fmtDateTime(p.recordedAt)}${sev ? ` · ${sev.severity} (${sev.direction === "above" ? "nad" : "pod"} mejo)` : " · v mejah"}`}</title>
          </circle>
        );
      })}
      {/* osi */}
      <line x1={padL} x2={padL} y1={padT} y2={padT + ih} className="stroke-border" strokeWidth={1} />
      <line x1={padL} x2={W - padR} y1={padT + ih} y2={padT + ih} className="stroke-border" strokeWidth={1} />
      <text x={2} y={y(max) + 3} fontSize={9} className="fill-muted-foreground">{fmtNum(max)}</text>
      <text x={2} y={y(min) + 3} fontSize={9} className="fill-muted-foreground">{fmtNum(min)}</text>
      {xLabels.map((i) => (
        <text key={i} x={Math.min(Math.max(x(i), padL), W - padR - 16)} y={H - 3} fontSize={9} className="fill-muted-foreground">{fmtDate(pts[i].recordedAt)}</text>
      ))}
    </svg>
  );
}
