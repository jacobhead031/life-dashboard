import type { CareerContact } from "./types";

// The plan: graduate in 2030 with ~12 months of sales-facing experience, OR exposure, and reps who know Jacob.
export const GATES = [
  { key: "foundation", name: "Foundation", start: "2026-01-01", end: "2027-04-30", gate: "Summer 2027 commercial work term signed" },
  { key: "term1", name: "First work term", start: "2027-05-01", end: "2028-08-31", gate: "1–2 specialties chosen, 3+ shadow days done" },
  { key: "close", name: "Close to the sales team", start: "2028-09-01", end: "2029-08-31", gate: "~12 months of sales-facing experience" },
  { key: "apply", name: "Apply", start: "2029-09-01", end: "2030-05-31", gate: "New-grad offer (J&J STR, Stryker ASR, Intuitive CTA)" },
  { key: "after", name: "After", start: "2030-06-01", end: "2099-12-31", gate: "Toronto rep → top performer → US transfer (L-1)" },
] as const;

export const WEEKLY_MESSAGE_TARGET = 5;

// Standing items that never leave the list; the agent doesn't re-add them as to-dos.
export const STANDING = [
  "Check the UTSC co-op portal (the agent can't log in)",
  "Every 2 weeks: a LinkedIn procedure-breakdown post (first: total knee replacement)",
];

export const APP_STATUSES = ["to_apply", "applied", "interview", "offer", "watch", "closed"] as const;
export const CONTACT_STAGES = ["found", "drafted", "sent", "replied", "call", "shadow"] as const;

export function currentGate(today: string) {
  return GATES.find((g) => today >= g.start && today <= g.end) ?? GATES[0];
}

/** Whole months from `since` to today; 0 when nothing has started. */
export function salesExpMonths(since: string | null | undefined, today: string): number {
  if (!since || since > today) return 0;
  const [y1, m1] = since.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const d1 = Number(since.slice(8));
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/** Weekly scorecard: messages sent this week, follow-ups due, and the streak of consecutive weeks with ≥1 message. */
export function scorecard(contacts: CareerContact[], weekMonday: string, today: string, mondayOf: (d: string) => string, addDays: (d: string, n: number) => string) {
  const sentThisWeek = contacts.filter((c) => c.sent_on && mondayOf(c.sent_on) === weekMonday).length;
  const followupsDue = contacts.filter((c) => c.next_followup && c.next_followup <= today && c.stage === "sent" && !c.do_not_contact).length;
  const replies = contacts.filter((c) => ["replied", "call", "shadow"].includes(c.stage)).length;
  const sent = contacts.filter((c) => c.sent_on).length;
  // Consecutive weeks with at least one message, counted back from this week (or last week if this one is still empty).
  const weeks = new Set(contacts.flatMap((c) => (c.sent_on ? [mondayOf(c.sent_on)] : [])));
  let streak = 0;
  for (let w = weeks.has(weekMonday) ? weekMonday : addDays(weekMonday, -7); weeks.has(w); w = addDays(w, -7)) streak++;
  return { sentThisWeek, followupsDue, replies, sent, streak };
}
