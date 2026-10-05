"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import type { LifeGoal } from "@/lib/types";
import { SEASON, moveGoalForDay, nextStep, pickForDay, tickNextStep } from "@/lib/life";
import { MEDITATIONS } from "@/lib/meditations";
import { daysBetween } from "@/lib/utils";
import { completeMove, logJournal, saveLifeGoal, saveLifeGoalSteps, setLifeCount } from "@/app/actions";

type DoneMove = { goal_id: string; move: string };
type Patch = Partial<LifeGoal> & { id: string };

export function ThisYearCard({
  goals: serverGoals,
  doneMove: serverDoneMove,
  journalDates,
  journalStart,
  todayStr: today,
}: {
  goals: LifeGoal[]; // active ones, in wall order
  doneMove: DoneMove | null; // today's move, once it has been pressed done
  journalDates: string[];
  journalStart: string | null;
  todayStr: string;
}) {
  const [, startTransition] = useTransition();
  const [goals, patch] = useOptimistic(serverGoals, (list, p: Patch) => list.map((g) => (g.id === p.id ? { ...g, ...p } : g)));
  const [doneMove, setDoneMove] = useOptimistic(serverDoneMove);
  const [journaled, setJournaled] = useOptimistic(journalDates.includes(today));
  const [next, setNext] = useState("");

  const live = goals.filter((g) => g.status !== "done");
  const quote = pickForDay(MEDITATIONS, today);
  const moveGoal = moveGoalForDay(live, today);
  const doneGoal = doneMove ? goals.find((g) => g.id === doneMove.goal_id) : undefined;

  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const start = journalStart ?? (journaled ? today : null);
  const journalDay = start ? daysBetween(start, today) + 1 : 0;

  function finishMove(g: LifeGoal) {
    startTransition(async () => {
      setDoneMove({ goal_id: g.id, move: g.next_move ?? "" });
      patch({ id: g.id, next_move: null });
      await completeMove(g.id);
    });
  }

  function saveNext(e: React.FormEvent) {
    e.preventDefault();
    const text = next.trim();
    if (!text || !doneGoal) return;
    setNext("");
    startTransition(async () => {
      patch({ id: doneGoal.id, next_move: text });
      await saveLifeGoal(doneGoal.id, { next_move: text });
    });
  }

  function tickStep(g: LifeGoal) {
    const steps = tickNextStep(g.steps, today);
    startTransition(async () => {
      patch({ id: g.id, steps });
      await saveLifeGoalSteps(g.id, steps);
    });
  }

  function plusOne(g: LifeGoal) {
    startTransition(async () => {
      patch({ id: g.id, count_current: g.count_current + 1 });
      await setLifeCount(g.id, g.count_current + 1);
    });
  }

  function toggleJournal() {
    startTransition(async () => {
      setJournaled(!journaled);
      await logJournal(today, !journaled);
    });
  }

  return (
    <section className="card span-6 life this-year" style={{ animationDelay: ".04s" }}>
      <div className="ty-head">
        <div>
          <div className="life-kicker">this year · {SEASON.label}</div>
          <h2 className="ty-date">{dateLabel}</h2>
        </div>
        <div className="ty-journal">
          <span className="ty-journal-count">
            {journalDay > 0 ? <>day <b>{journalDay}</b> of 365</> : "journal streak"}
          </span>
          <button type="button" className={`d-btn${journaled ? " on" : ""}`} aria-pressed={journaled} onClick={toggleJournal}>
            {journaled ? "✓ journaled" : "✍️ log today"}
          </button>
        </div>
      </div>

      {quote && (
        <blockquote className="ty-quote">
          “{quote[0]}” <cite>Meditations {quote[1]}</cite>
        </blockquote>
      )}

      {serverGoals.length === 0 ? (
        <div className="empty-state">
          <p>No active goals yet.</p>
          <Link href="/life" className="empty-link">→ start the life list</Link>
        </div>
      ) : (
        <>
          <div className="ty-move">
            <div className="life-kicker">today&apos;s move</div>
            {doneMove ? (
              <>
                <p className="ty-move-text done">✓ {doneMove.move}</p>
                {doneGoal && !doneGoal.next_move ? (
                  <form className="quick-add-row" onSubmit={saveNext}>
                    <input
                      className="quick-add-input"
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      placeholder={`Next move for ${doneGoal.title}…`}
                      aria-label={`Next move for ${doneGoal.title}`}
                      maxLength={500}
                    />
                    <button type="submit" className="d-btn" disabled={!next.trim()}>set</button>
                  </form>
                ) : (
                  doneGoal && <p className="ty-move-goal">{doneGoal.emoji} {doneGoal.title} · next: {doneGoal.next_move}</p>
                )}
              </>
            ) : moveGoal ? (
              <div className="ty-move-row">
                <div>
                  <p className="ty-move-text">{moveGoal.next_move}</p>
                  <p className="ty-move-goal">{moveGoal.emoji} {moveGoal.title}</p>
                </div>
                <button type="button" className="btn primary" onClick={() => finishMove(moveGoal)}>done</button>
              </div>
            ) : (
              <p className="ty-move-goal">No next moves set. Open a goal and give it one.</p>
            )}
          </div>

          <div className="ty-tiles">
            {live.map((g) => {
              const step = nextStep(g.steps);
              const stepsDone = g.steps.filter((s) => s.done).length;
              return (
                <div key={g.id} className="ty-tile">
                  <div className="ty-tile-title"><span aria-hidden>{g.emoji}</span> {g.title}</div>

                  {g.type === "countdown" && g.target_date && (
                    <div className="ty-big">
                      {Math.max(0, daysBetween(today, g.target_date))}<small>days to go</small>
                    </div>
                  )}
                  {g.type === "countdown" && g.steps.length > 0 && (
                    <div className="bar" role="img" aria-label={`${stepsDone} of ${g.steps.length} steps done`}>
                      <i style={{ width: `${(stepsDone / g.steps.length) * 100}%` }} />
                    </div>
                  )}
                  {g.type === "ladder" && (
                    <div className="ty-dots" role="img" aria-label={`${stepsDone} of ${g.steps.length} steps done`}>
                      {g.steps.map((s, i) => <span key={i} className={s.done ? "on" : ""} />)}
                    </div>
                  )}
                  {g.type === "count" && (
                    <>
                      <div className="ty-big">
                        {g.count_current}<small>/ {g.season_target ?? g.lifetime_target ?? "–"}</small>
                      </div>
                      <div className="ty-sub">
                        {g.season_target != null && <>{g.count_current} / {g.season_target} this season</>}
                        {g.season_target != null && g.lifetime_target != null && " · "}
                        {g.lifetime_target != null && <>{g.count_current} / {g.lifetime_target} lifetime</>}
                      </div>
                    </>
                  )}

                  <div className="ty-tile-foot">
                    {g.type === "count" ? (
                      <button type="button" className="d-btn" onClick={() => plusOne(g)} aria-label={`Add one to ${g.title}`}>+1</button>
                    ) : g.steps.length > 0 ? (
                      <>
                        <span className="ty-sub">{step ? <>Next: <b>{step.label}</b></> : "Every step done"}</span>
                        {step && <button type="button" className="d-btn" onClick={() => tickStep(g)} aria-label={`Tick step: ${step.label}`}>✓ step</button>}
                      </>
                    ) : (
                      <span className="ty-sub">{g.next_move ?? g.first_move ?? ""}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Link href="/life" className="ty-link">See the whole life list →</Link>
        </>
      )}
    </section>
  );
}
