import type { LifeGoal, LifeStep } from "./types";

// "This season" on the count tiles. Roll it over by editing these three values.
export const SEASON = { label: "2027 Season", start: "2026-10-01", end: "2027-12-31" };

export const LIFE_CATEGORIES = ["Adventure", "Body", "Build", "Skills", "People", "Mind"] as const;

// Counts are derived from life_counter_entry rows; only the targets live here.
export const LIFE_COUNTERS = [
  { key: "countries", label: "Countries", target: 50 },
  { key: "continents", label: "Continents", target: 6 },
  { key: "wonders", label: "Wonders", target: 7 },
  { key: "concerts", label: "Concerts", target: 20 },
] as const;

/** One item per calendar day, the same all day and on every device. */
export function pickForDay<T>(list: readonly T[], today: string): T | null {
  if (!list.length) return null;
  const day = Math.round(Date.parse(today) / 86_400_000);
  return list[((day % list.length) + list.length) % list.length];
}

/** Today's move comes from the active, unfinished goals that have a next move set. */
export function moveGoalForDay<G extends Pick<LifeGoal, "active" | "status" | "next_move">>(goals: G[], today: string): G | null {
  return pickForDay(goals.filter((g) => g.active && g.status !== "done" && !!g.next_move?.trim()), today);
}

export function nextStep(steps: LifeStep[]): LifeStep | null {
  return steps.find((s) => !s.done) ?? null;
}

/** Ticks the first open step, stamping the day it was done. */
export function tickNextStep(steps: LifeStep[], today: string): LifeStep[] {
  const i = steps.findIndex((s) => !s.done);
  return i < 0 ? steps : steps.map((s, j) => (j === i ? { ...s, done: true, doneDate: today } : s));
}
