"use client";
// Chart helpers shared by /coach and /stats (moved out of the retired Health tab, Nov 5 2026).

import { useState } from "react";

/* WHOOP recovery bands: 67+ green, 34–66 yellow, <34 red */
export function recoveryColor(pct: number) {
  if (pct >= 67) return "var(--green)";
  if (pct >= 34) return "var(--amber)";
  return "var(--coral)";
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type Pt = { date: string; value: number };

/* One-series sparkline: 2px line, last-point dot, min/max in muted ink,
   hover crosshair + tooltip. Identity comes from the card label, not color. */
export function Sparkline({
  points,
  color,
  format,
  height = 72,
}: {
  points: Pt[];
  color: string;
  format: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const PAD = 6;
  if (points.length < 2) {
    return <p className="health-empty">Not enough data yet.</p>;
  }
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (height - 2 * PAD);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="spark-wrap">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="spark-svg"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD) / (W - 2 * PAD)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {h && (
          <line x1={x(hover!)} y1={0} x2={x(hover!)} y2={height} stroke="var(--muted-2)" strokeWidth="1" />
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && <circle cx={x(hover!)} cy={y(h.value)} r="4" fill={color} stroke="var(--card)" strokeWidth="2" />}
        {!h && <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill={color} />}
      </svg>
      <div className="spark-foot">
        <span>{h ? `${fmtDate(h.date)} · ${format(h.value)}` : `${fmtDate(points[0].date)} – ${fmtDate(last.date)}`}</span>
        <span>{h ? "" : `low ${format(min)} · high ${format(max)}`}</span>
      </div>
    </div>
  );
}

/* One-series bar strip: rounded data-ends, 2px gaps, hover tooltip. */
export function Bars({
  points,
  color,
  format,
  height = 72,
}: {
  points: { date: string; value: number | null }[];
  color: string;
  format: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const vals = points.filter((p) => p.value !== null).map((p) => p.value!);
  if (!vals.length) return <p className="health-empty">Not enough data yet.</p>;
  const max = Math.max(...vals);
  const bw = W / points.length;
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="spark-wrap">
      <svg viewBox={`0 0 ${W} ${height}`} className="spark-svg" onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const bh = p.value ? Math.max(4, (p.value / max) * (height - 8)) : 0;
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              {/* full-height invisible hit target, wider than the mark */}
              <rect x={i * bw} y={0} width={bw} height={height} fill="transparent" />
              {p.value !== null && (
                <rect
                  x={i * bw + 1}
                  y={height - bh}
                  width={Math.max(2, bw - 2)}
                  height={bh}
                  rx="2"
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="spark-foot">
        <span>
          {h
            ? `${fmtDate(h.date)} · ${h.value !== null ? format(h.value) : "not logged"}`
            : `${fmtDate(points[0].date)} – ${fmtDate(points[points.length - 1].date)}`}
        </span>
        <span>{h ? "" : `high ${format(max)}`}</span>
      </div>
    </div>
  );
}
