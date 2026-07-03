"use client";

import { useOptimistic, useTransition } from "react";
import { setSunriseSunset } from "@/app/actions";
import type { SunriseSunset } from "@/lib/types";

const MONS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// Point on the upper semicircle. pct=0 → left (10,100), pct=1 → right (190,100)
function arcPoint(pct: number): { x: number; y: number } {
  const alpha = (1 - pct) * Math.PI;
  return { x: 100 + 90 * Math.cos(alpha), y: 100 - 90 * Math.sin(alpha) };
}

const SUNRISE_POS = arcPoint(0.25);
const SUNSET_POS  = arcPoint(0.75);

type State = { sunriseDone: boolean; sunsetDone: boolean };

export function SunriseSunsetCard({
  ss,
  currentMonthStr,
}: {
  ss: SunriseSunset | null;
  currentMonthStr: string;
}) {
  const initial: State = {
    sunriseDone: ss?.sunrise_done ?? false,
    sunsetDone:  ss?.sunset_done  ?? false,
  };

  const [isPending, startTransition] = useTransition();
  const [state, applyOptimistic] = useOptimistic(
    initial,
    (prev: State, next: Partial<State>) => ({ ...prev, ...next })
  );

  function toggle(field: "sunriseDone" | "sunsetDone") {
    const next = { ...state, [field]: !state[field] };
    startTransition(async () => {
      applyOptimistic({ [field]: !state[field] });
      await setSunriseSunset(
        currentMonthStr,
        next.sunriseDone,
        next.sunsetDone
      );
    });
  }

  const monthName = MONS[parseInt(currentMonthStr.split("-")[1]) - 1];
  const anyDone = state.sunriseDone || state.sunsetDone;

  return (
    <section className="card span-3 month-card" style={{ animationDelay: ".16s" }}>
      <div className="card-label">sunrise &amp; sunset · {monthName}</div>

      <div className="arc-wrap">
        <svg
          viewBox="0 0 200 110"
          role="img"
          aria-label="Sunrise and sunset tracker"
        >
          <defs>
            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E76F51" stopOpacity={anyDone ? "0.5" : "0.15"} />
              <stop offset="100%" stopColor="#F4A259" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sun-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F4A259" />
              <stop offset="100%" stopColor="#E76F51" />
            </linearGradient>
          </defs>

          <path d="M10 100 A 90 90 0 0 1 190 100 Z" fill="url(#sky-grad)" />
          <path d="M10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#2A2E3A" strokeWidth="2" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#2A2E3A" strokeWidth="2" />

          {state.sunriseDone ? (
            <circle cx={SUNRISE_POS.x} cy={SUNRISE_POS.y} r="9" fill="url(#sun-grad)" />
          ) : (
            <circle cx="10" cy="100" r="6" fill="none" stroke="#5C616E" strokeWidth="2" strokeDasharray="3 3" />
          )}

          {state.sunsetDone ? (
            <circle cx={SUNSET_POS.x} cy={SUNSET_POS.y} r="9" fill="url(#sun-grad)" />
          ) : (
            <circle cx="190" cy="100" r="6" fill="none" stroke="#5C616E" strokeWidth="2" strokeDasharray="3 3" />
          )}
        </svg>
      </div>

      <div className="arc-legend">
        <button
          className="arc-toggle"
          onClick={() => !isPending && toggle("sunriseDone")}
          aria-label={state.sunriseDone ? "unmark sunrise" : "mark sunrise done"}
          disabled={isPending}
        >
          <span>sunrise </span>
          <b className={state.sunriseDone ? "done-val" : ""}>
            {state.sunriseDone ? "1/1" : "0/1"}
          </b>
          {!state.sunriseDone && (
            <span className="arc-nudge">mark done</span>
          )}
        </button>

        <button
          className="arc-toggle"
          onClick={() => !isPending && toggle("sunsetDone")}
          aria-label={state.sunsetDone ? "unmark sunset" : "mark sunset done"}
          disabled={isPending}
        >
          <span>sunset </span>
          <b className={state.sunsetDone ? "done-val" : ""}>
            {state.sunsetDone ? "1/1" : "0/1"}
          </b>
          {!state.sunsetDone && (
            <span className="arc-nudge">mark done</span>
          )}
        </button>
      </div>
    </section>
  );
}
