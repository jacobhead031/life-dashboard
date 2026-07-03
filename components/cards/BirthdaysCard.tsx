"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addBirthday } from "@/app/actions";
import type { RecurringDate } from "@/lib/types";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const MONTHS_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

function daysUntil(month: number, day: number, today: Date): number {
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  const target = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, month - 1, day);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - todayMidnight.getTime()) / 86_400_000);
}

export function BirthdaysCard({ birthdays }: { birthdays: RecurringDate[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [relationship, setRelationship] = useState("");
  const [isPending, startTransition] = useTransition();

  const today = new Date();

  const sorted = [...birthdays].sort(
    (a, b) => daysUntil(a.month, a.day, today) - daysUntil(b.month, b.day, today)
  );

  function handleAdd() {
    if (!name.trim()) return;
    const data = { name: name.trim(), month, day, relationship: relationship.trim() || null, lead_days: 7 };
    setShowAdd(false);
    setName("");
    setMonth(1);
    setDay(1);
    setRelationship("");
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
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 3 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Person's name"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="d-field">
              <label>Relationship</label>
              <input
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. friend"
              />
            </div>
            <div className="d-field">
              <label>Month</label>
              <select
                value={month}
                onChange={(e) => {
                  const m = parseInt(e.target.value);
                  setMonth(m);
                  if (day > daysInMonth(m)) setDay(1);
                }}
              >
                {MONTHS_FULL.map((mn, i) => (
                  <option key={i + 1} value={i + 1}>{mn}</option>
                ))}
              </select>
            </div>
            <div className="d-field">
              <label>Day</label>
              <select value={day} onChange={(e) => setDay(parseInt(e.target.value))}>
                {Array.from({ length: daysInMonth(month) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="d-form-actions">
            <button className="btn primary" onClick={handleAdd} disabled={!name.trim()}>
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
            const days = daysUntil(b.month, b.day, today);
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
