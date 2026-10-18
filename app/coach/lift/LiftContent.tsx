"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveLiftSets } from "@/app/actions";
import type { TriLiftSet, TriSession } from "@/lib/types";
import { addDays, weekMonday } from "@/lib/utils";
import { parseExercises, suggest, type Exercise } from "@/lib/lifts";

type SetDraft = { set_no: number; reps: string; weight_lb: string; rpe: string };

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ExerciseCard({ ex, date, history, busy, onSave }: {
  ex: Exercise; date: string; history: TriLiftSet[]; busy: boolean;
  onSave: (exercise: string, sets: SetDraft[]) => void;
}) {
  const mine = history.filter((h) => h.exercise === ex.name);
  const todayRows = mine.filter((h) => h.date === date);
  const lastDate = mine.find((h) => h.date !== date)?.date;
  const last = lastDate ? mine.filter((h) => h.date === lastDate) : [];
  const tip = ex.bodyweight ? { weight: 0, text: last.length ? `last time ${last.map((s) => s.reps ?? "?").join(", ")} reps` : "bodyweight: log reps; add weight when all sets are easy" } : suggest(last, ex);
  const [sets, setSets] = useState<SetDraft[]>(() =>
    Array.from({ length: ex.sets }, (_, i) => {
      const t = todayRows.find((r) => r.set_no === i + 1);
      return {
        set_no: i + 1,
        reps: t?.reps != null ? String(t.reps) : String(ex.reps),
        weight_lb: t?.weight_lb != null ? String(t.weight_lb) : tip.weight != null ? String(tip.weight) : "",
        rpe: t?.rpe != null ? String(t.rpe) : "",
      };
    }),
  );
  const logged = todayRows.length > 0;
  return (
    <div className="coach-session lift-card" style={{ "--chip": logged ? "var(--green)" : "var(--muted-2)" } as React.CSSProperties}>
      <div className="coach-session-head">
        <strong>{ex.name}</strong>
        <span className="coach-meta">{ex.sets} x {ex.reps}{ex.rpe ? ` @ RPE ${ex.rpe}` : ""}</span>
        <span className="coach-status">{logged ? "logged" : ""}</span>
      </div>
      <p className="coach-why">{ex.note}</p>
      <p className="lift-tip">{tip.text}</p>
      <div className="lift-sets">
        <div className="lift-row lift-head"><span>set</span><span>lb</span><span>reps</span><span>rpe</span></div>
        {sets.map((s, i) => (
          <div className="lift-row" key={s.set_no}>
            <span className="coach-meta">{s.set_no}</span>
            <input type="number" inputMode="decimal" step="2.5" value={s.weight_lb} placeholder={ex.bodyweight ? "0" : "lb"}
              onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight_lb: e.target.value } : x)))} />
            <input type="number" inputMode="numeric" value={s.reps}
              onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
            <input type="number" inputMode="numeric" min={1} max={10} value={s.rpe} placeholder="7"
              onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, rpe: e.target.value } : x)))} />
          </div>
        ))}
      </div>
      <div className="coach-actions">
        <button className="d-btn" disabled={busy} onClick={() => setSets(sets.map((s, i) => (i === 0 ? s : { ...s, weight_lb: sets[0].weight_lb, reps: sets[0].reps, rpe: sets[0].rpe })))}>copy set 1 down</button>
        <button className="d-btn success" disabled={busy} onClick={() => onSave(ex.name, sets)}>{logged ? "Update" : "Save"}</button>
      </div>
    </div>
  );
}

export function LiftContent({ monday, today, sessions, history }: { monday: string; today: string; sessions: TriSession[]; history: TriLiftSet[] }) {
  const [isPending, startTransition] = useTransition();
  const thisMonday = weekMonday(today);
  const recentDays = [...new Set(history.map((h) => h.date))].slice(0, 6);

  function saveFor(session: TriSession) {
    return (exercise: string, sets: SetDraft[]) =>
      startTransition(() =>
        saveLiftSets({
          date: session.date, session_id: session.id, exercise,
          sets: sets.map((s) => ({ set_no: s.set_no, reps: s.reps === "" ? null : Number(s.reps), weight_lb: s.weight_lb === "" ? null : Number(s.weight_lb), rpe: s.rpe === "" ? null : Number(s.rpe) })),
        }),
      );
  }

  return (
    <div className="grid-bento">
      <section className="card span-6" style={{ paddingBottom: 12 }}>
        <div className="card-label">
          <span>lifts · {monday === thisMonday ? "this week" : monday === addDays(thisMonday, 7) ? "next week" : `week of ${fmtDay(monday)}`}{isPending ? " · saving…" : ""}</span>
          <span className="coach-weeknav">
            <Link className="d-btn" href="/coach">← coach</Link>
            <Link className="d-btn" href={`/coach/lift?week=${addDays(monday, -7)}`} aria-label="Previous week">‹</Link>
            <Link className="d-btn" href="/coach/lift">this week</Link>
            <Link className="d-btn" href={`/coach/lift?week=${addDays(monday, 7)}`} aria-label="Next week">›</Link>
          </span>
        </div>
        {sessions.length === 0 && <div className="empty-state"><p>No gym sessions this week.</p></div>}
        {sessions.length > 0 && (
          <p className="coach-meta">{sessions.map((s) => `${fmtDay(s.date)}: ${s.title}`).join(" · ")}. Weights in lb. Save each exercise; re-saving replaces that day&rsquo;s sets.</p>
        )}
      </section>

      {sessions.map((session) => {
        const exercises = parseExercises(session.structure);
        const logged = history.filter((h) => h.date === session.date).length;
        return (
          <section className="card span-6" key={session.id} id={session.date}>
            <div className="card-label">
              <span>{fmtDay(session.date)} · {session.title}{session.date === today ? " · today" : ""}</span>
              <span className="card-nav">{logged ? `${logged} sets logged` : session.status}</span>
            </div>
            {session.purpose && <p className="coach-why" style={{ marginBottom: 8 }}>{session.purpose}</p>}
            {exercises.length === 0 && <div className="empty-state"><p>No exercises on this session yet. They arrive with the Sunday build.</p></div>}
            {exercises.map((ex) => (
              <ExerciseCard key={ex.name + session.date} ex={ex} date={session.date} history={history} busy={isPending} onSave={saveFor(session)} />
            ))}
          </section>
        );
      })}

      {recentDays.length > 0 && (
        <section className="card span-6">
          <div className="card-label"><span>recent lifts</span></div>
          <table className="coach-gear stats-table">
            <thead><tr><th>day</th><th>exercise</th><th>sets</th></tr></thead>
            <tbody>
              {recentDays.flatMap((d) => {
                const byEx = new Map<string, TriLiftSet[]>();
                history.filter((h) => h.date === d).forEach((h) => byEx.set(h.exercise, [...(byEx.get(h.exercise) ?? []), h]));
                return [...byEx.entries()].map(([ex, rows]) => (
                  <tr key={d + ex}>
                    <td className="coach-meta">{fmtDay(d)}</td>
                    <td>{ex}</td>
                    <td>{rows.sort((a, b) => a.set_no - b.set_no).map((r) => `${r.weight_lb ?? 0}x${r.reps ?? "?"}`).join(" · ")}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
