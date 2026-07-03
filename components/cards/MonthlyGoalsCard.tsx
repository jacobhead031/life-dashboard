"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleGoal } from "@/app/actions";
import type { MonthlyGoal } from "@/lib/types";

const MONS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export function MonthlyGoalsCard({
  goals: initialGoals,
  currentMonthStr,
}: {
  goals: MonthlyGoal[];
  currentMonthStr: string;
}) {
  const monthIdx = parseInt(currentMonthStr.split("-")[1]) - 1;
  const monthName = MONS[monthIdx];
  const hasCarryOver = initialGoals.some((g) => g.origin_month !== g.month);

  const [isPending, startTransition] = useTransition();
  const [goals, applyOptimistic] = useOptimistic(
    initialGoals,
    (
      state: MonthlyGoal[],
      { id, done }: { id: string; done: boolean }
    ) => state.map((g) => (g.id === id ? { ...g, done } : g))
  );

  function handleToggle(id: string, currentDone: boolean) {
    startTransition(async () => {
      applyOptimistic({ id, done: !currentDone });
      await toggleGoal(id, !currentDone);
    });
  }

  return (
    <section className="card span-2" style={{ animationDelay: ".04s" }}>
      <div className="card-label">
        this month · {monthName}
        {hasCarryOver ? " · carries over" : ""}
      </div>

      {goals.length === 0 ? (
        <div className="empty-state">
          <p>No goals yet this month. Add one to get started.</p>
          <Link href="/goals" className="empty-link">
            → manage goals
          </Link>
        </div>
      ) : (
        goals.map((goal) => {
          const originMonthIdx =
            parseInt(goal.origin_month.split("-")[1]) - 1;
          const fromLabel =
            goal.origin_month !== goal.month
              ? MONS[originMonthIdx]
              : null;

          return (
            <div
              key={goal.id}
              className={`mgoal${goal.done ? " done" : ""}`}
              onClick={() => !isPending && handleToggle(goal.id, goal.done)}
              role="checkbox"
              aria-checked={goal.done}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !isPending) {
                  e.preventDefault();
                  handleToggle(goal.id, goal.done);
                }
              }}
              style={{ cursor: isPending ? "wait" : "pointer" }}
            >
              <span className="box">{goal.done ? "✓" : ""}</span>
              <span className="m-text">{goal.text}</span>
              {fromLabel && <span className="carry">from {fromLabel}</span>}
            </div>
          );
        })
      )}
    </section>
  );
}
