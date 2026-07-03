"use client";

import { useState, useOptimistic, useTransition } from "react";
import { addGoal, deleteGoal, toggleGoal, carryOverGoals } from "@/app/actions";
import type { MonthlyGoal } from "@/lib/types";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

function GoalRow({
  goal,
  currentMonth,
  onToggle,
  onDelete,
}: {
  goal: MonthlyGoal;
  currentMonth: string;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isCurrentMonth = goal.month === currentMonth;
  const isCarryOver = goal.origin_month !== goal.month;

  return (
    <div
      className={`mgoal${goal.done ? " done" : ""}`}
      onClick={() => isCurrentMonth && onToggle(goal.id, goal.done)}
      role={isCurrentMonth ? "checkbox" : undefined}
      aria-checked={isCurrentMonth ? goal.done : undefined}
      tabIndex={isCurrentMonth ? 0 : undefined}
      onKeyDown={(e) => {
        if (isCurrentMonth && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onToggle(goal.id, goal.done);
        }
      }}
      style={{ cursor: isCurrentMonth ? "pointer" : "default" }}
    >
      <span className="box">{goal.done ? "✓" : ""}</span>
      <span className="m-text">{goal.text}</span>
      {isCarryOver && (
        <span className="carry">
          from{" "}
          {MONTH_NAMES[parseInt(goal.origin_month.split("-")[1]) - 1].slice(0, 3).toLowerCase()}
        </span>
      )}
      {isCurrentMonth && (
        <button
          className="d-btn danger"
          style={{ marginLeft: "auto", padding: "2px 8px" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(goal.id);
          }}
          aria-label="Delete goal"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function GoalsContent({
  goals,
  currentMonth,
}: {
  goals: MonthlyGoal[];
  currentMonth: string;
}) {
  const [, startTransition] = useTransition();
  const [newGoalText, setNewGoalText] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set()
  );

  const [optimisticGoals, applyOptimistic] = useOptimistic(
    goals,
    (
      state: MonthlyGoal[],
      action:
        | { type: "toggle"; id: string; done: boolean }
        | { type: "delete"; id: string }
    ) => {
      if (action.type === "toggle") {
        return state.map((g) =>
          g.id === action.id ? { ...g, done: action.done } : g
        );
      }
      return state.filter((g) => g.id !== action.id);
    }
  );

  function handleToggle(id: string, currentDone: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id, done: !currentDone });
      await toggleGoal(id, !currentDone);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteGoal(id);
    });
  }

  async function handleAdd() {
    if (!newGoalText.trim()) return;
    const text = newGoalText.trim();
    setNewGoalText("");
    await addGoal(text, currentMonth);
  }

  function toggleMonth(month: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  }

  // Carry-over detection
  function prevMonth(m: string): string {
    const [y, mo] = m.split("-").map(Number);
    return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  }
  const lastMonth = prevMonth(currentMonth);
  const lastMonthName = MONTH_NAMES[parseInt(lastMonth.split("-")[1]) - 1];
  const currentTexts = new Set(
    optimisticGoals.filter((g) => g.month === currentMonth).map((g) => g.text)
  );
  const carryable = optimisticGoals.filter(
    (g) => g.month === lastMonth && !g.done && !currentTexts.has(g.text)
  );

  async function handleCarryOver() {
    await carryOverGoals(lastMonth, currentMonth);
  }

  // Group by month
  const monthMap = new Map<string, MonthlyGoal[]>();
  for (const g of optimisticGoals) {
    const arr = monthMap.get(g.month) ?? [];
    arr.push(g);
    monthMap.set(g.month, arr);
  }
  const months = Array.from(monthMap.keys()).sort((a, b) =>
    b.localeCompare(a)
  );

  const currentGoals = monthMap.get(currentMonth) ?? [];
  const pastMonths = months.filter((m) => m !== currentMonth);

  return (
    <div>
      {/* Carry-over banner */}
      {carryable.length > 0 && (
        <div className="carry-banner">
          <span>
            {carryable.length} incomplete goal{carryable.length !== 1 ? "s" : ""} from {lastMonthName}
          </span>
          <button className="d-btn" onClick={handleCarryOver}>
            carry over
          </button>
        </div>
      )}

      {/* Current month */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "20px 22px",
          marginBottom: 18,
        }}
      >
        <div className="card-label" style={{ marginBottom: 12 }}>
          {formatMonth(currentMonth)} · current
        </div>

        {currentGoals.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: 12 }}>
            No goals yet this month.
          </p>
        ) : (
          currentGoals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              currentMonth={currentMonth}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* Quick add */}
        <div className="quick-add-row">
          <input
            className="quick-add-input"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            placeholder="Add a goal for this month…"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            className="d-btn"
            onClick={handleAdd}
            disabled={!newGoalText.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Past months */}
      {pastMonths.map((month) => {
        const monthGoals = monthMap.get(month) ?? [];
        const doneCount = monthGoals.filter((g) => g.done).length;
        const isOpen = expandedMonths.has(month);

        return (
          <div key={month} className="month-section">
            <button
              className="month-toggle"
              onClick={() => toggleMonth(month)}
              aria-expanded={isOpen}
            >
              <span className="m-arrow">{isOpen ? "▾" : "▸"}</span>
              {formatMonth(month)}
              <span className="m-stats">
                {doneCount}/{monthGoals.length} done
              </span>
            </button>

            {isOpen && (
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "0 0 var(--radius) var(--radius)",
                  padding: "4px 22px 16px",
                  borderTop: "none",
                  marginTop: -1,
                }}
              >
                {monthGoals.map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    currentMonth={currentMonth}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {months.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: 8 }}>
          Goals you add this month will appear here. Past months will be
          accessible below for reference.
        </p>
      )}
    </div>
  );
}
