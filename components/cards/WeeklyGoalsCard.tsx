"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { toggleWeeklyGoal, addWeeklyGoal, deleteWeeklyGoal, setWeeklyGoalProgress } from "@/app/actions";
import type { WeeklyGoal } from "@/lib/types";

export function WeeklyGoalsCard({
  goals: serverGoals,
  weekStr,
}: {
  goals: WeeklyGoal[];
  weekStr: string;
}) {
  const [goals, setGoals] = useState(serverGoals);
  // Sync when server re-renders deliver fresh data
  useEffect(() => { setGoals(serverGoals); }, [serverGoals]);

  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    const target = parseInt(targetDraft) || 0;
    const temp: WeeklyGoal = {
      id: "temp-" + Date.now(),
      user_id: "", text, week: weekStr,
      done: false, target, current: 0, created_at: "",
    };
    setDraft("");
    setTargetDraft("");
    setGoals((prev) => [...prev, temp]);
    startTransition(async () => { await addWeeklyGoal(text, weekStr, target); });
  }

  function handleToggle(g: WeeklyGoal) {
    setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, done: !x.done } : x));
    startTransition(async () => { await toggleWeeklyGoal(g.id, !g.done); });
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => { await deleteWeeklyGoal(id); });
  }

  function handleProgress(g: WeeklyGoal, delta: number) {
    const next = Math.max(0, g.current + delta);
    setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, current: next, done: next >= x.target } : x));
    startTransition(async () => { await setWeeklyGoalProgress(g.id, next, g.target); });
  }

  const done = goals.filter((g) => g.target > 0 ? g.current >= g.target : g.done).length;
  const weekLabel = new Date(weekStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <section className="card span-6" style={{ animationDelay: ".05s" }}>
      <div className="card-label">
        <span>this week · {weekLabel}{goals.length > 0 ? ` · ${done}/${goals.length}` : ""}</span>
      </div>

      {goals.map((g) => (
        <div key={g.id} style={{ opacity: g.id.startsWith("temp-") ? 0.6 : 1 }}>
          {g.target > 0 ? (
            /* ── Progress goal ── */
            <div className={`mgoal${g.current >= g.target ? " done" : ""}`} style={{ display: "flex", alignItems: "center", cursor: "default" }}>
              <span className="box">{g.current >= g.target ? "✓" : ""}</span>
              <span className="m-text" style={{ flex: 1 }}>{g.text}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                <button
                  className="d-btn"
                  style={{ padding: "1px 8px", fontSize: "16px", lineHeight: 1 }}
                  onClick={() => handleProgress(g, -1)}
                  disabled={isPending || g.current <= 0}
                >−</button>
                <span style={{ fontFamily: "var(--font-space-mono)", fontSize: "12px", minWidth: 36, textAlign: "center" }}>
                  {g.current}/{g.target}
                </span>
                <button
                  className="d-btn"
                  style={{ padding: "1px 8px", fontSize: "16px", lineHeight: 1 }}
                  onClick={() => handleProgress(g, 1)}
                  disabled={isPending || g.current >= g.target}
                >+</button>
              </div>
              <button
                className="d-btn danger"
                style={{ marginLeft: 8, opacity: 0.4, fontSize: "11px", padding: "2px 6px" }}
                onClick={() => handleDelete(g.id)}
              >✕</button>
            </div>
          ) : (
            /* ── Checkbox goal ── */
            <div
              className={`mgoal${g.done ? " done" : ""}`}
              style={{ display: "flex", alignItems: "center", cursor: isPending ? "wait" : "pointer" }}
              onClick={() => !isPending && !g.id.startsWith("temp-") && handleToggle(g)}
              role="checkbox"
              aria-checked={g.done}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !isPending && !g.id.startsWith("temp-")) {
                  e.preventDefault();
                  handleToggle(g);
                }
              }}
            >
              <span className="box">{g.done ? "✓" : ""}</span>
              <span className="m-text" style={{ flex: 1 }}>{g.text}</span>
              <button
                className="d-btn danger"
                style={{ marginLeft: 8, opacity: 0.4, fontSize: "11px", padding: "2px 6px" }}
                onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
              >✕</button>
            </div>
          )}
        </div>
      ))}

      {/* Add row */}
      {showAdd ? (
        <div className="quick-add-row" style={{ marginTop: goals.length ? 8 : 0, display: "flex", gap: 8 }}>
          <input
            ref={textRef}
            className="quick-add-input"
            style={{ flex: 1 }}
            placeholder="goal name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={isPending}
            autoFocus
          />
          <input
            className="quick-add-input"
            style={{ width: 80 }}
            type="number"
            min={0}
            placeholder="target?"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={isPending}
          />
          <button className="btn" onClick={() => { setShowAdd(false); setDraft(""); setTargetDraft(""); }}>
            ✕
          </button>
        </div>
      ) : (
        <button
          className="d-btn"
          style={{ marginTop: goals.length ? 8 : 0 }}
          onClick={() => setShowAdd(true)}
        >
          + add goal
        </button>
      )}
    </section>
  );
}
