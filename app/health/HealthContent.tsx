"use client";

import { useState } from "react";
import type { HealthDay, HealthRecs } from "@/lib/types";

/* WHOOP recovery bands: 67+ green, 34–66 yellow, <34 red */
function recoveryColor(pct: number) {
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
function Sparkline({
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
function Bars({
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

export function HealthContent({
  days,
  weighIns,
  latestRecs,
}: {
  days: HealthDay[];
  weighIns: { date: string; weight: number }[];
  latestRecs: HealthRecs | null;
}) {
  const latest = [...days].reverse();
  const lastRecovery = latest.find((d) => d.recovery_pct !== null);
  const lastSleep = latest.find((d) => d.sleep_hours !== null);
  const lastWeight = weighIns[weighIns.length - 1];
  const prevWeight = weighIns[weighIns.length - 2];
  const weightDelta = lastWeight && prevWeight ? lastWeight.weight - prevWeight.weight : null;

  const sleepVals = days.filter((d) => d.sleep_hours !== null).map((d) => d.sleep_hours!);
  const sleepAvg = sleepVals.length ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : null;

  // Calorie logging streak: consecutive logged days ending at the newest row
  let streak = 0;
  for (const d of latest) {
    if (d.calories !== null) streak++;
    else break;
  }

  const spark = (key: "recovery_pct" | "hrv" | "sleep_hours") =>
    days.filter((d) => d[key] !== null).map((d) => ({ date: d.date, value: d[key]! }));

  return (
    <div className="grid-bento">
      {/* ── This week's targets ── */}
      <section className="card span-6">
        <div className="card-label">
          <span>
            this week&apos;s targets{latestRecs ? ` · from ${fmtDate(latestRecs.week_of)} review` : ""}
          </span>
        </div>
        {latestRecs ? (
          <ol className="rec-list">
            {latestRecs.recs.map((r, i) => (
              <li key={i} className="rec-item">
                <span className="rec-num">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <p>No weekly targets yet — they arrive with the Sunday coaching deck.</p>
          </div>
        )}
      </section>

      {/* ── Stat tiles ── */}
      <section className="card span-2" style={{ animationDelay: ".05s" }}>
        <div className="card-label"><span>recovery</span></div>
        {lastRecovery ? (
          <>
            <div className="stat-num" style={{ color: recoveryColor(lastRecovery.recovery_pct!) }}>
              {Math.round(lastRecovery.recovery_pct!)}%
            </div>
            <div className="stat-sub">
              {fmtDate(lastRecovery.date)} · HRV {Math.round(lastRecovery.hrv ?? 0)} ms · RHR{" "}
              {Math.round(lastRecovery.rhr ?? 0)} bpm
            </div>
          </>
        ) : (
          <p className="health-empty">No data.</p>
        )}
      </section>

      <section className="card span-2" style={{ animationDelay: ".08s" }}>
        <div className="card-label"><span>sleep</span></div>
        {lastSleep ? (
          <>
            <div className="stat-num">{lastSleep.sleep_hours!.toFixed(1)}h</div>
            <div className="stat-sub">
              {fmtDate(lastSleep.date)}
              {sleepAvg ? ` · 28d avg ${sleepAvg.toFixed(1)}h` : ""}
            </div>
          </>
        ) : (
          <p className="health-empty">No data.</p>
        )}
      </section>

      <section className="card span-2" style={{ animationDelay: ".11s" }}>
        <div className="card-label"><span>weight</span></div>
        {lastWeight ? (
          <>
            <div className="stat-num">
              {lastWeight.weight}
              {weightDelta !== null && (
                <span className="stat-delta">
                  {weightDelta > 0 ? "+" : ""}
                  {weightDelta.toFixed(1)}
                </span>
              )}
            </div>
            <div className="stat-sub">weighed {fmtDate(lastWeight.date)}</div>
          </>
        ) : (
          <p className="health-empty">No weigh-ins yet.</p>
        )}
      </section>

      {/* ── Trends ── */}
      <section className="card span-3" style={{ animationDelay: ".14s" }}>
        <div className="card-label"><span>recovery · 28 days</span></div>
        <Sparkline points={spark("recovery_pct")} color="var(--green)" format={(v) => `${Math.round(v)}%`} />
      </section>

      <section className="card span-3" style={{ animationDelay: ".17s" }}>
        <div className="card-label"><span>sleep · 28 days</span></div>
        <Sparkline points={spark("sleep_hours")} color="var(--sky)" format={(v) => `${v.toFixed(1)}h`} />
      </section>

      <section className="card span-3" style={{ animationDelay: ".2s" }}>
        <div className="card-label">
          <span>calories · 28 days{streak > 1 ? ` · ${streak}-day logging streak` : ""}</span>
        </div>
        <Bars
          points={days.map((d) => ({ date: d.date, value: d.calories }))}
          color="var(--amber)"
          format={(v) => `${Math.round(v)} kcal`}
        />
      </section>

      <section className="card span-3" style={{ animationDelay: ".23s" }}>
        <div className="card-label"><span>weight · weigh-ins</span></div>
        <Sparkline
          points={weighIns.map((w) => ({ date: w.date, value: w.weight }))}
          color="var(--coral)"
          format={(v) => `${v}`}
        />
      </section>
    </div>
  );
}
