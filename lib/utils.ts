import type { RecurringDate } from "./types";

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
  today: Date
): UpcomingBirthday | null {
  let closest: UpcomingBirthday | null = null;

  for (const b of birthdays) {
    // Try this year, fall back to next year if already passed
    const thisYear = new Date(today.getFullYear(), b.month - 1, b.day);
    const nextYear = new Date(today.getFullYear() + 1, b.month - 1, b.day);
    const target = thisYear >= today ? thisYear : nextYear;

    // Use start-of-day comparison so "today" shows as 0 days
    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const daysUntil = Math.round(
      (target.getTime() - todayMidnight.getTime()) / 86400000
    );

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
      dayName: DAY_NAMES[target.getDay()],
      relLabel,
    };

    if (!closest || daysUntil < closest.daysUntil) {
      closest = entry;
    }
  }

  return closest;
}
