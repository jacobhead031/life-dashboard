"use client";

import { useState, useRef } from "react";
import {
  addReflection,
  addReflectionNote,
  deleteReflection,
  deleteReflectionNote,
} from "@/app/actions";
import type { Reflection, ReflectionNote } from "@/lib/types";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const dayN = d.getDate();
  const year = d.getFullYear();
  const thisYear = new Date().getFullYear();
  return year === thisYear ? `${month} ${dayN}` : `${month} ${dayN}, ${year}`;
}

function NoteInput({
  reflectionId,
  onSaved,
}: {
  reflectionId: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    const t = text.trim();
    setText("");
    await addReflectionNote(reflectionId, t);
    setSaving(false);
    onSaved();
    ref.current?.focus();
  }

  return (
    <div className="note-add-row">
      <textarea
        ref={ref}
        className="note-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a thought…"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        disabled={saving}
      />
      <button
        className="d-btn"
        onClick={save}
        disabled={!text.trim() || saving}
        style={{ alignSelf: "flex-end", flexShrink: 0 }}
      >
        {saving ? "…" : "save"}
      </button>
    </div>
  );
}

export function ReflectionContent({
  reflections,
  notes,
}: {
  reflections: Reflection[];
  notes: ReflectionNote[];
}) {
  const [showAddReflection, setShowAddReflection] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingReflection, setAddingReflection] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const notesByReflection = notes.reduce(
    (acc, n) => {
      acc[n.reflection_id] = (acc[n.reflection_id] ?? []).concat(n);
      return acc;
    },
    {} as Record<string, ReflectionNote[]>
  );

  async function handleAddReflection() {
    if (!newName.trim()) return;
    setAddingReflection(true);
    setShowAddReflection(false);
    const n = newName.trim();
    setNewName("");
    await addReflection(n);
    setAddingReflection(false);
  }

  async function handleDeleteReflection(r: Reflection) {
    const noteCount = notesByReflection[r.id]?.length ?? 0;
    const msg =
      noteCount > 0
        ? `Delete "${r.name}" and its ${noteCount} note${noteCount !== 1 ? "s" : ""}?`
        : `Delete "${r.name}"?`;
    if (!confirm(msg)) return;
    await deleteReflection(r.id);
  }

  async function handleDeleteNote(note: ReflectionNote) {
    if (!confirm("Delete this note?")) return;
    await deleteReflectionNote(note.id);
  }

  function toggleExpand(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="detail-top-row">
        <span style={{ color: "var(--muted)", fontSize: "13.5px" }}>
          {reflections.length} area{reflections.length !== 1 ? "s" : ""}
        </span>
        <button
          className="btn primary"
          onClick={() => setShowAddReflection((v) => !v)}
          disabled={addingReflection}
        >
          {showAddReflection ? "✕ cancel" : "+ add area"}
        </button>
      </div>

      {showAddReflection && (
        <div className="add-panel">
          <div className="add-panel-title">new reflection area</div>
          <div className="d-form-row">
            <div className="d-field">
              <label>Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Put yourself first"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddReflection()}
              />
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAddReflection}
              disabled={!newName.trim()}
            >
              Add area
            </button>
            <button
              className="btn"
              onClick={() => setShowAddReflection(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reflections.length === 0 ? (
        <div className="d-reflect">
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            No reflection areas yet. Add one — it becomes a place to log
            small thoughts and check in with yourself over time.
          </p>
        </div>
      ) : (
        reflections.map((r) => {
          const rNotes = notesByReflection[r.id] ?? [];
          const showing = expandedNotes.has(r.id) ? rNotes : rNotes.slice(0, 3);
          const hasMore = rNotes.length > 3 && !expandedNotes.has(r.id);

          return (
            <div key={r.id} className="d-reflect">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div className="d-reflect-name">{r.name}</div>
                <button
                  className="d-btn danger"
                  onClick={() => handleDeleteReflection(r)}
                  style={{ flexShrink: 0 }}
                >
                  delete
                </button>
              </div>

              {/* Note history */}
              {showing.length > 0 && (
                <div className="note-list">
                  {showing.map((note) => (
                    <div key={note.id} className="note-item">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                        }}
                      >
                        <div className="note-time">{relTime(note.created_at)}</div>
                        <button
                          className="d-btn danger"
                          style={{ padding: "1px 6px", fontSize: "9.5px" }}
                          onClick={() => handleDeleteNote(note)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="note-text">{note.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {hasMore && (
                <button
                  className="d-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => toggleExpand(r.id)}
                >
                  show {rNotes.length - 3} more
                </button>
              )}

              {expandedNotes.has(r.id) && rNotes.length > 3 && (
                <button
                  className="d-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => toggleExpand(r.id)}
                >
                  show less
                </button>
              )}

              {rNotes.length === 0 && (
                <p
                  style={{
                    color: "var(--muted-2)",
                    fontSize: "13.5px",
                    marginBottom: 8,
                  }}
                >
                  No notes yet.
                </p>
              )}

              <NoteInput
                reflectionId={r.id}
                onSaved={() => {}}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
