"use client";

import { useState, useTransition } from "react";
import { addBirthday, updateBirthday, deleteBirthday } from "@/app/actions";
import type { RecurringDate } from "@/lib/types";
import { BirthdayFields, EMPTY_BIRTHDAY } from "@/components/BirthdayFields";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function BirthdaysContent({
  birthdays,
}: {
  birthdays: RecurringDate[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState(EMPTY_BIRTHDAY);
  const [editDraft, setEditDraft] = useState(EMPTY_BIRTHDAY);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!draft.name.trim()) return;
    const data = { name: draft.name.trim(), month: draft.month, day: draft.day, relationship: draft.relationship.trim() || null, lead_days: parseInt(draft.leadDays) || 7 };
    setShowAdd(false);
    setDraft(EMPTY_BIRTHDAY);
    startTransition(async () => {
      await addBirthday(data);
    });
  }

  function startEdit(b: RecurringDate) {
    setEditingId(b.id);
    setEditDraft({ name: b.name, relationship: b.relationship ?? "", month: b.month, day: b.day, leadDays: String(b.lead_days) });
  }

  function handleSaveEdit(b: RecurringDate) {
    setEditingId(null);
    startTransition(async () => {
      await updateBirthday(b.id, {
        name: editDraft.name.trim() || b.name,
        month: editDraft.month,
        day: editDraft.day,
        relationship: editDraft.relationship.trim() || null,
        lead_days: parseInt(editDraft.leadDays) || 7,
      });
    });
  }

  function handleDelete(b: RecurringDate) {
    if (!confirm(`Delete ${b.name}'s birthday?`)) return;
    startTransition(async () => {
      await deleteBirthday(b.id);
    });
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
          <BirthdayFields value={draft} onChange={setDraft} relationshipPlaceholder="e.g. partner, sister" />
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!draft.name.trim()}
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
                    <BirthdayFields value={editDraft} onChange={setEditDraft} relationshipPlaceholder="optional" />
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
