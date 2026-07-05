"use client";

import { useState, useTransition, useOptimistic } from "react";
import { addHabit, deleteHabit, toggleHabitLog } from "@/app/actions";
import type { Habit, HabitLog } from "@/lib/types";

const COLOR: Record<string, string> = {
  amber: "var(--amber)",
  sky:   "var(--sky)",
  green: "var(--green)",
  coral: "var(--coral)",
};

const SWATCHES = ["sky", "amber", "green", "coral"];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthGrid({
  habit,
  logs,
  year,
  month,
  todayStr,
  onToggle,
}: {
  habit: Habit;
  logs: HabitLog[];
  year: number;
  month: number;
  todayStr: string;
  onToggle: (date: string, isDone: boolean) => void;
}) {
  const color = COLOR[habit.color] ?? "var(--sky)";
  const done = new Set(
    logs.filter((l) => l.habit_id === habit.id).map((l) => l.date)
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="habit-cal-header">
        {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="habit-cal-grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isDone = done.has(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          return (
            <button
              key={dateStr}
              className={`habit-cal-dot${isDone ? " done" : ""}${isToday ? " today" : ""}`}
              style={isDone ? { background: color, borderColor: color } : isToday ? { borderColor: color } : undefined}
              onClick={() => !isFuture && onToggle(dateStr, !isDone)}
              disabled={isFuture}
              title={dateStr}
            >
              {!isDone && <span style={{ fontSize: "9px", color: isToday ? color : "var(--muted-2)" }}>{day}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HabitsContent({
  habits: initialHabits,
  logs: initialLogs,
  todayStr,
  currentYear,
  currentMonth,
}: {
  habits: Habit[];
  logs: HabitLog[];
  todayStr: string;
  currentYear: number;
  currentMonth: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("sky");

  const [logs, applyOptimisticLog] = useOptimistic(
    initialLogs,
    (state: HabitLog[], action: { type: "add" | "remove"; habitId: string; date: string }) => {
      if (action.type === "add") {
        return [...state, { id: "opt-" + Date.now(), user_id: "", habit_id: action.habitId, date: action.date, created_at: "" }];
      }
      return state.filter((l) => !(l.habit_id === action.habitId && l.date === action.date));
    }
  );

  function handleAdd() {
    if (!newName.trim()) return;
    const name = newName.trim();
    const color = newColor;
    setShowAdd(false);
    setNewName("");
    setNewColor("sky");
    startTransition(async () => { await addHabit(name, color); });
  }

  function handleDelete(habit: Habit) {
    if (!confirm(`Delete "${habit.name}" and all its history?`)) return;
    startTransition(async () => { await deleteHabit(habit.id); });
  }

  function handleToggle(habit: Habit, date: string, isDone: boolean) {
    startTransition(async () => {
      applyOptimisticLog({ type: isDone ? "add" : "remove", habitId: habit.id, date });
      await toggleHabitLog(habit.id, date, isDone);
    });
  }

  return (
    <div>
      <div className="detail-top-row">
        <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "22px", fontWeight: 600, margin: 0 }}>
          Habits
        </h1>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={isPending}
        >
          {showAdd ? "✕ cancel" : "+ new habit"}
        </button>
      </div>

      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new habit</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 1 }}>
              <label>Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Meditate, Read, Workout"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="arc-label" style={{ marginBottom: 8 }}>Color</div>
            <div className="habit-color-pick">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`color-swatch${newColor === c ? " selected" : ""}`}
                  style={{ background: COLOR[c] }}
                  onClick={() => setNewColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="d-form-actions">
            <button className="btn primary" onClick={handleAdd} disabled={!newName.trim()}>
              Add habit
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {initialHabits.length === 0 ? (
        <div className="card-full" style={{ padding: 22 }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            No habits yet. Add one to start tracking.
          </p>
        </div>
      ) : (
        initialHabits.map((habit) => {
          const color = COLOR[habit.color] ?? "var(--sky)";
          const doneToday = logs.some((l) => l.habit_id === habit.id && l.date === todayStr);
          return (
            <div key={habit.id} className="card-full" style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "16px", fontWeight: 600, flex: 1 }}>
                  {habit.name}
                </span>
                <button
                  className={`habit-circle-sm${doneToday ? " done" : ""}`}
                  style={{ "--habit-color": color } as React.CSSProperties}
                  onClick={() => handleToggle(habit, todayStr, !doneToday)}
                  disabled={isPending}
                >
                  {doneToday ? "✓ done today" : "○ mark today"}
                </button>
                <button className="d-btn danger" onClick={() => handleDelete(habit)}>delete</button>
              </div>
              <div style={{ padding: "0 0 16px" }}>
                <div style={{ fontFamily: "var(--font-space-mono)", fontSize: "10px", letterSpacing: 1, textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 10 }}>
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </div>
                <MonthGrid
                  habit={habit}
                  logs={logs}
                  year={currentYear}
                  month={currentMonth}
                  todayStr={todayStr}
                  onToggle={(date, isDone) => handleToggle(habit, date, isDone)}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
