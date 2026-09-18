"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addBirthday } from "@/app/actions";
import type { RecurringDate } from "@/lib/types";
import { daysUntilAnnual, todayStr } from "@/lib/utils";
import { BirthdayFields, EMPTY_BIRTHDAY } from "@/components/BirthdayFields";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export function BirthdaysCard({ birthdays }: { birthdays: RecurringDate[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(EMPTY_BIRTHDAY);
  const [isPending, startTransition] = useTransition();

  const today = todayStr();

  const sorted = [...birthdays].sort(
    (a, b) => daysUntilAnnual(a.month, a.day, today) - daysUntilAnnual(b.month, b.day, today)
  );

  function handleAdd() {
    if (!draft.name.trim()) return;
    const data = { name: draft.name.trim(), month: draft.month, day: draft.day, relationship: draft.relationship.trim() || null, lead_days: 7 };
    setShowAdd(false);
    setDraft(EMPTY_BIRTHDAY);
    startTransition(async () => {
      await addBirthday(data);
    });
  }

  return (
    <section className="card span-6" style={{ animationDelay: ".22s" }}>
      <div className="card-label">
        <span>birthdays</span>
        <Link href="/birthdays" className="card-nav">manage →</Link>
      </div>

      {/* Quick-add form */}
      {showAdd && (
        <div className="add-panel" style={{ marginBottom: 14 }}>
          <BirthdayFields value={draft} onChange={setDraft} relationshipPlaceholder="e.g. friend" compact onEnter={handleAdd} />
          <div className="d-form-actions">
            <button className="btn primary" onClick={handleAdd} disabled={!draft.name.trim()}>
              Add birthday
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Birthday list */}
      {sorted.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: "13.5px", marginBottom: 14 }}>
          No birthdays yet — add one and the dashboard will alert you ahead of time.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", marginBottom: 14 }}>
          {sorted.map((b) => {
            const days = daysUntilAnnual(b.month, b.day, today);
            const soon = days <= b.lead_days;
            return (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                <span style={{ fontFamily: "var(--font-space-mono)", fontSize: "11px", color: soon ? "var(--amber)" : "var(--muted-2)", minWidth: 32 }}>
                  {days === 0 ? "today" : days === 1 ? "tmrw" : `${days}d`}
                </span>
                <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{b.name}</span>
                <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>
                  {MONTHS[b.month - 1]} {b.day}
                  {b.relationship && ` · ${b.relationship}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="btn primary"
        onClick={() => setShowAdd((v) => !v)}
        disabled={isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {isPending ? "saving…" : showAdd ? "✕ cancel" : "+ add birthday"}
      </button>
    </section>
  );
}
