"use client";

import { useOptimistic, useTransition, useState, useRef } from "react";
import { toggleWeeklyGoal, addWeeklyGoal, deleteWeeklyGoal } from "@/app/actions";
import type { WeeklyGoal } from "@/lib/types";

export function WeeklyGoalsCard({
  goals: initialGoals,
  weekStr,
}: {
  goals: WeeklyGoal[];
  weekStr: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const [goals, applyOptimistic] = useOptimistic(
    initialGoals,
    (state: WeeklyGoal[], action: { type: "toggle"; id: string; done: boolean } | { type: "delete"; id: string }) =>
      action.type === "toggle"
        ? state.map((g) => (g.id === action.id ? { ...g, done: action.done } : g))
        : state.filter((g) => g.id !== action.id)
  );

  function handleToggle(g: WeeklyGoal) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: g.id, done: !g.done });
      await toggleWeeklyGoal(g.id, !g.done);
    });
  }

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => { await addWeeklyGoal(text, weekStr); });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteWeeklyGoal(id);
    });
  }

  const done = goals.filter((g) => g.done).length;
  const weekLabel = new Date(weekStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <section className="card span-6" style={{ animationDelay: ".05s" }}>
      <div className="card-label">
        <span>this week · {weekLabel}{goals.length > 0 ? ` · ${done}/${goals.length}` : ""}</span>
      </div>

      {goals.map((g) => (
        <div
          key={g.id}
          className={`mgoal${g.done ? " done" : ""}`}
          style={{ cursor: isPending ? "wait" : "pointer", display: "flex", alignItems: "center" }}
          onClick={() => !isPending && handleToggle(g)}
          role="checkbox"
          aria-checked={g.done}
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !isPending) {
              e.preventDefault();
              handleToggle(g);
            }
          }}
        >
          <span className="box">{g.done ? "✓" : ""}</span>
          <span className="m-text" style={{ flex: 1 }}>{g.text}</span>
          <button
            className="d-btn danger"
            style={{ marginLeft: 8, opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
            aria-label="delete"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="quick-add-row" style={{ marginTop: goals.length ? 8 : 0 }}>
        <input
          ref={inputRef}
          className="quick-add-input"
          placeholder="+ add a goal for this week"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={isPending}
        />
      </div>
    </section>
  );
}
