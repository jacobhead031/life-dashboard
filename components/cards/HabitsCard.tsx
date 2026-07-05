"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleHabitLog } from "@/app/actions";
import type { Habit, HabitLog } from "@/lib/types";

const COLOR: Record<string, string> = {
  amber: "var(--amber)",
  sky:   "var(--sky)",
  green: "var(--green)",
  coral: "var(--coral)",
};

function getStreak(logs: HabitLog[], habitId: string, today: string): number {
  const done = new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date));
  let streak = 0;
  // start from today if done, else from yesterday
  const d = new Date(today + "T12:00:00Z");
  if (!done.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (done.has(d.toISOString().split("T")[0])) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

function getPast7(logs: HabitLog[], habitId: string, today: string): boolean[] {
  const done = new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return done.has(d.toISOString().split("T")[0]);
  });
}

export function HabitsCard({
  habits,
  logs: initialLogs,
  todayStr,
}: {
  habits: Habit[];
  logs: HabitLog[];
  todayStr: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [logs, applyOptimistic] = useOptimistic(
    initialLogs,
    (state: HabitLog[], action: { type: "add" | "remove"; habitId: string }) => {
      if (action.type === "add") {
        return [...state, { id: "opt-" + action.habitId, user_id: "", habit_id: action.habitId, date: todayStr, created_at: "" }];
      }
      return state.filter((l) => !(l.habit_id === action.habitId && l.date === todayStr));
    }
  );

  function toggle(habit: Habit) {
    const isDone = logs.some((l) => l.habit_id === habit.id && l.date === todayStr);
    startTransition(async () => {
      applyOptimistic({ type: isDone ? "remove" : "add", habitId: habit.id });
      await toggleHabitLog(habit.id, todayStr, !isDone);
    });
  }

  const allDone = habits.length > 0 && habits.every((h) =>
    logs.some((l) => l.habit_id === h.id && l.date === todayStr)
  );

  return (
    <section className="card span-6" style={{ animationDelay: ".24s" }}>
      <div className="card-label">
        <span>habits · today{allDone ? "  ✦ all done" : ""}</span>
        <Link href="/habits" className="card-nav">manage →</Link>
      </div>

      {habits.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: "13.5px", marginTop: 10 }}>
          No habits yet.{" "}
          <Link href="/habits" style={{ color: "var(--sky)" }}>Add your first →</Link>
        </div>
      ) : (
        <div className="habit-list">
          {habits.map((habit) => {
            const color = COLOR[habit.color] ?? "var(--sky)";
            const done = logs.some((l) => l.habit_id === habit.id && l.date === todayStr);
            const streak = getStreak(logs, habit.id, todayStr);
            const past7 = getPast7(logs, habit.id, todayStr);

            return (
              <div key={habit.id} className="habit-row">
                <button
                  className={`habit-circle${done ? " done" : ""}`}
                  style={{ "--habit-color": color } as React.CSSProperties}
                  onClick={() => !isPending && toggle(habit)}
                  disabled={isPending}
                  aria-label={done ? `Uncheck ${habit.name}` : `Check ${habit.name}`}
                />
                <span className="habit-name">{habit.name}</span>
                <div className="habit-dots">
                  {past7.map((d, i) => (
                    <span
                      key={i}
                      className="habit-dot"
                      style={d ? { background: color, opacity: 0.75 } : undefined}
                    />
                  ))}
                </div>
                <span className="habit-streak">
                  {streak >= 3 ? `🔥 ${streak}` : streak > 0 ? `· ${streak}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
