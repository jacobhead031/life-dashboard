import type { RecurringDate } from "./types";

// ── Dates ────────────────────────────────────────────────────
// Every "today" in the app goes through todayStr(). The server runs in UTC, so
// new Date().toISOString() is already tomorrow from 8pm Eastern.
const TZ = "America/Toronto";

/** Today's calendar date, YYYY-MM-DD, in Jacob's timezone. Same on server and client. */
export function todayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Pure YYYY-MM-DD arithmetic (UTC internally, so no zone or DST drift). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing dateStr. */
export function weekMonday(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return addDays(dateStr, -(dow === 0 ? 6 : dow - 1));
}

/** Whole days from one YYYY-MM-DD to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Days until the next occurrence of month/day; 0 on the day itself. */
export function daysUntilAnnual(month: number, day: number, today: string): number {
  const year = Number(today.slice(0, 4));
  // Date.UTC rolls Feb 29 over to Mar 1 in non-leap years instead of returning NaN.
  const until = (y: number) => Math.round((Date.UTC(y, month - 1, day) - Date.parse(today)) / 86_400_000);
  return until(year) >= 0 ? until(year) : until(year + 1);
}

// ── Birthdays ────────────────────────────────────────────────
const DAY_NAMES = [
  "sunday","monday","tuesday","wednesday","thursday","friday","saturday",
];

export type UpcomingBirthday = {
  birthday: RecurringDate;
  daysUntil: number;
  dayName: string;
  relLabel: string;
};

export function getUpcomingBirthday(
  birthdays: RecurringDate[],
  today: string // YYYY-MM-DD, from todayStr()
): UpcomingBirthday | null {
  let closest: UpcomingBirthday | null = null;

  for (const b of birthdays) {
    const daysUntil = daysUntilAnnual(b.month, b.day, today);
    if (daysUntil > b.lead_days) continue;

    const relLabel =
      daysUntil === 0
        ? "today"
        : daysUntil === 1
        ? "tomorrow"
        : `in ${daysUntil} days`;

    const entry: UpcomingBirthday = {
      birthday: b,
      daysUntil,
      dayName: DAY_NAMES[new Date(`${addDays(today, daysUntil)}T00:00:00Z`).getUTCDay()],
      relLabel,
    };

    if (!closest || daysUntil < closest.daysUntil) {
      closest = entry;
    }
  }

  return closest;
}
