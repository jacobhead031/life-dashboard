"use client";

import { useState, useTransition } from "react";
import { addBirthday, updateBirthday, deleteBirthday } from "@/app/actions";
import type { RecurringDate } from "@/lib/types";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

export function BirthdaysContent({
  birthdays,
}: {
  birthdays: RecurringDate[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [relationship, setRelationship] = useState("");
  const [leadDays, setLeadDays] = useState("7");
  const [isPending, startTransition] = useTransition();

  // Edit form state (mirrors add)
  const [editName, setEditName] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  const [editDay, setEditDay] = useState(1);
  const [editRelationship, setEditRelationship] = useState("");
  const [editLeadDays, setEditLeadDays] = useState("7");

  function handleAdd() {
    if (!name.trim()) return;
    const data = { name: name.trim(), month, day, relationship: relationship.trim() || null, lead_days: parseInt(leadDays) || 7 };
    setShowAdd(false);
    setName("");
    setMonth(1);
    setDay(1);
    setRelationship("");
    setLeadDays("7");
    startTransition(async () => {
      await addBirthday(data);
    });
  }

  function startEdit(b: RecurringDate) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditMonth(b.month);
    setEditDay(b.day);
    setEditRelationship(b.relationship ?? "");
    setEditLeadDays(String(b.lead_days));
  }

  async function handleSaveEdit(b: RecurringDate) {
    setEditingId(null);
    await updateBirthday(b.id, {
      name: editName.trim() || b.name,
      month: editMonth,
      day: editDay,
      relationship: editRelationship.trim() || null,
      lead_days: parseInt(editLeadDays) || 7,
    });
  }

  async function handleDelete(b: RecurringDate) {
    if (!confirm(`Delete ${b.name}'s birthday?`)) return;
    await deleteBirthday(b.id);
  }

  return (
    <div>
      <div className="detail-top-row">
        <span style={{ color: "var(--muted)", fontSize: "13.5px" }}>
          {birthdays.length} birthday{birthdays.length !== 1 ? "s" : ""}
        </span>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={isPending}
        >
          {showAdd ? "✕ cancel" : "+ add birthday"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new birthday</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 2 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Person's name"
                autoFocus
              />
            </div>
            <div className="d-field">
              <label>Relationship</label>
              <input
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. partner, sister"
              />
            </div>
          </div>
          <div className="d-form-row">
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
                {MONTHS.map((mn, i) => (
                  <option key={i + 1} value={i + 1}>
                    {mn}
                  </option>
                ))}
              </select>
            </div>
            <div className="d-field">
              <label>Day</label>
              <select
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value))}
              >
                {Array.from({ length: daysInMonth(month) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="d-field">
              <label>Lead days</label>
              <input
                type="number"
                value={leadDays}
                onChange={(e) => setLeadDays(e.target.value)}
                min={0}
                max={60}
                placeholder="7"
              />
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!name.trim()}
            >
              Add birthday
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {birthdays.length === 0 ? (
        <div className="card-full" style={{ padding: "22px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            No birthdays yet. Add one and the dashboard will show a banner in
            the days leading up to it.
          </p>
        </div>
      ) : (
        <div className="card-full">
          {birthdays.map((b) => {
            const isEditing = editingId === b.id;
            return (
              <div key={b.id} className="d-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                {isEditing ? (
                  <div>
                    <div className="d-form-row">
                      <div className="d-field" style={{ flex: 2 }}>
                        <label>Name</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="d-field">
                        <label>Relationship</label>
                        <input
                          value={editRelationship}
                          onChange={(e) => setEditRelationship(e.target.value)}
                          placeholder="optional"
                        />
                      </div>
                    </div>
                    <div className="d-form-row">
                      <div className="d-field">
                        <label>Month</label>
                        <select
                          value={editMonth}
                          onChange={(e) => {
                            const m = parseInt(e.target.value);
                            setEditMonth(m);
                            if (editDay > daysInMonth(m)) setEditDay(1);
                          }}
                        >
                          {MONTHS.map((mn, i) => (
                            <option key={i + 1} value={i + 1}>
                              {mn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="d-field">
                        <label>Day</label>
                        <select
                          value={editDay}
                          onChange={(e) =>
                            setEditDay(parseInt(e.target.value))
                          }
                        >
                          {Array.from(
                            { length: daysInMonth(editMonth) },
                            (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div className="d-field">
                        <label>Lead days</label>
                        <input
                          type="number"
                          value={editLeadDays}
                          onChange={(e) => setEditLeadDays(e.target.value)}
                          min={0}
                          max={60}
                        />
                      </div>
                    </div>
                    <div className="d-form-actions">
                      <button
                        className="btn primary"
                        onClick={() => handleSaveEdit(b)}
                      >
                        Save
                      </button>
                      <button
                        className="btn"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                    }}
                  >
                    <div className="d-item-main">
                      <div className="d-item-title">{b.name}</div>
                      <div className="d-item-meta">
                        {MONTHS[b.month - 1]} {b.day}
                        {b.relationship && ` · ${b.relationship}`}
                        {" · "}
                        <span style={{ color: "var(--sky)" }}>
                          {b.lead_days}d lead
                        </span>
                      </div>
                    </div>
                    <div className="d-item-actions">
                      <button
                        className="d-btn"
                        onClick={() => startEdit(b)}
                      >
                        edit
                      </button>
                      <button
                        className="d-btn danger"
                        onClick={() => handleDelete(b)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
