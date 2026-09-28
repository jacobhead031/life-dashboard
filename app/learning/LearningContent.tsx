"use client";

import { useOptimistic, useState, useTransition } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addTrack,
  updateTrack,
  saveTrackSteps,
  setActiveTrack,
  deleteTrack,
} from "@/app/actions";
import type { LearningStep, LearningTrack } from "@/lib/types";

const CIRC = 2 * Math.PI * 16;

function TrackRing({ track }: { track: LearningTrack }) {
  const pct =
    track.total_steps > 0 ? track.completed_steps / track.total_steps : 0;
  const color = track.accent === "amber" ? "var(--amber)" : "var(--sky)";
  const offset = CIRC * (1 - pct);
  return (
    <svg className="ring" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="16" fill="none" stroke="var(--base-2)" strokeWidth="3.5" />
      <circle
        cx="21" cy="21" r="16"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 21 21)"
      />
    </svg>
  );
}

function StepRow({
  step,
  n,
  onToggle,
  onRename,
  onDelete,
}: {
  step: LearningStep;
  n: number;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <div
      ref={setNodeRef}
      className="step-item"
      style={{
        cursor: "default",
        opacity: isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}),
      }}
    >
      <span className="todo-drag-handle" {...attributes} {...listeners} aria-label={`Move step ${n}`}>⠿</span>
      <button
        className={`step-check${step.done ? " done" : ""}`}
        style={{ cursor: "pointer", padding: 0 }}
        role="checkbox"
        aria-checked={step.done}
        aria-label={`Step ${n}${step.title ? `: ${step.title}` : ""}`}
        onClick={onToggle}
      >
        {step.done && "✓"}
      </button>
      {/* Uncontrolled + keyed on the saved title, so fresh server data replaces the draft without an effect. */}
      <input
        key={step.title}
        className={`step-title${step.done ? " done" : ""}`}
        defaultValue={step.title}
        placeholder={`Step ${n}`}
        aria-label={`Step ${n} name`}
        onBlur={(e) => { if (e.target.value.trim() !== step.title) onRename(e.target.value.trim()); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { e.currentTarget.value = step.title; e.currentTarget.blur(); }
        }}
      />
      <button className="cal-x step-x" aria-label={`Delete step ${n}`} onClick={onDelete}>×</button>
    </div>
  );
}

function StepList({ track, onChange }: { track: LearningTrack; onChange: (steps: LearningStep[]) => void }) {
  const steps = track.steps;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const patch = (id: string, p: Partial<LearningStep>) => steps.map((s) => (s.id === id ? { ...s, ...p } : s));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) onChange(arrayMove(steps, from, to));
  }

  function handleDelete(step: LearningStep, n: number) {
    // Only named or ticked steps are worth a second thought.
    if ((step.title || step.done) && !confirm(`Delete step ${n}${step.title ? ` "${step.title}"` : ""}?`)) return;
    onChange(steps.filter((s) => s.id !== step.id));
  }

  return (
    <div className="steps">
      <DndContext id={`steps-${track.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              n={i + 1}
              onToggle={() => onChange(patch(s.id, { done: !s.done }))}
              onRename={(title) => onChange(patch(s.id, { title }))}
              onDelete={() => handleDelete(s, i + 1)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <input
        className="step-title step-add"
        placeholder="+ add a step"
        aria-label="Add a step"
        onKeyDown={(e) => {
          const title = e.currentTarget.value.trim();
          if (e.key !== "Enter" || !title) return;
          onChange([...steps, { id: crypto.randomUUID(), title, done: false }]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function LearningContent({ tracks: serverTracks }: { tracks: LearningTrack[] }) {
  const [isPending, startTransition] = useTransition();
  // Ticks, renames and drags get their own transition so they don't flip the header to "saving…".
  const [, startQuiet] = useTransition();
  const [tracks, patchTrack] = useOptimistic(serverTracks, (state, patch: Partial<LearningTrack> & { id: string }) =>
    state.map((t) => (t.id === patch.id ? { ...t, ...patch } : t)),
  );
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [totalSteps, setTotalSteps] = useState("5");
  const [currentLabel, setCurrentLabel] = useState("");
  const [accent, setAccent] = useState<"amber" | "sky">("sky");

  function handleAdd() {
    if (!name.trim()) return;
    const data = { name: name.trim(), total_steps: parseInt(totalSteps) || 5, current_label: currentLabel.trim(), accent };
    setShowAdd(false);
    setName("");
    setTotalSteps("5");
    setCurrentLabel("");
    setAccent("sky");
    startTransition(async () => {
      await addTrack(data);
    });
  }

  function handleSteps(track: LearningTrack, steps: LearningStep[]) {
    startQuiet(async () => {
      patchTrack({
        id: track.id,
        steps,
        total_steps: steps.length,
        completed_steps: steps.filter((s) => s.done).length,
        current_label: steps.find((s) => !s.done)?.title ?? "",
      });
      await saveTrackSteps(track.id, steps);
    });
  }

  function handleField(track: LearningTrack, patch: { name?: string; url?: string | null; notes?: string | null; accent?: "amber" | "sky" }) {
    startQuiet(async () => {
      patchTrack({ id: track.id, ...patch });
      await updateTrack(track.id, patch);
    });
  }

  function handleLink(track: LearningTrack, raw: string) {
    const v = raw.trim();
    // "coursera.org/x" is what people paste; the server only accepts http(s).
    const url = !v ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`;
    if (url !== track.url) handleField(track, { url });
  }

  function handleSetActive(id: string) {
    startTransition(async () => { await setActiveTrack(id); });
  }

  function handleDelete(track: LearningTrack) {
    if (!confirm(`Delete "${track.name}"?`)) return;
    startTransition(async () => { await deleteTrack(track.id); });
  }

  return (
    <div>
      <div className="detail-top-row">
        <span style={{ color: "var(--muted)", fontSize: "13.5px" }}>
          {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </span>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={isPending}
        >
          {isPending ? "saving…" : showAdd ? "✕ cancel" : "+ add track"}
        </button>
      </div>

      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new track</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 3 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales course"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="d-field">
              <label>Total steps</label>
              <input
                type="number"
                value={totalSteps}
                onChange={(e) => setTotalSteps(e.target.value)}
                min={1}
                max={50}
              />
            </div>
          </div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 3 }}>
              <label>First step description</label>
              <input
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                placeholder="e.g. intro module"
              />
            </div>
            <div className="d-field">
              <label>Focus</label>
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value as "amber" | "sky")}
              >
                <option value="sky">Regular</option>
                <option value="amber">Active focus</option>
              </select>
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!name.trim()}
            >
              Add track
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="card-full" style={{ padding: "22px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            No learning tracks yet. Add one to start tracking progress.
          </p>
        </div>
      ) : (
        tracks.map((track) => {
          const isOpen = expanded === track.id;
          const pct =
            track.total_steps > 0
              ? Math.round(
                  (track.completed_steps / track.total_steps) * 100
                )
              : 0;
          const accentColor =
            track.accent === "amber" ? "var(--amber)" : "var(--sky)";

          return (
            <div
              key={track.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              {/* Track header */}
              <div
                className={`track-header${isOpen ? " open" : ""}`}
                style={{ padding: "14px 18px" }}
                onClick={() => setExpanded(isOpen ? null : track.id)}
                role="button"
                aria-expanded={isOpen}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
                    e.preventDefault();
                    setExpanded(isOpen ? null : track.id);
                  }
                }}
              >
                <TrackRing track={track} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="l-name">{track.name}</span>
                    {track.accent === "amber" && (
                      <span
                        className="tag-pill"
                        style={{
                          color: "var(--amber)",
                          borderColor: "rgba(244,162,89,.3)",
                          background: "rgba(244,162,89,.08)",
                        }}
                      >
                        active
                      </span>
                    )}
                  </div>
                  <div className="l-meta">
                    {track.completed_steps}/{track.total_steps} steps ·{" "}
                    <span style={{ color: accentColor }}>{pct}%</span>
                  </div>
                </div>
                {track.url && (
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-nav"
                    onClick={(e) => e.stopPropagation()}
                  >
                    open course ↗
                  </a>
                )}
                <span
                  style={{
                    color: "var(--muted-2)",
                    fontSize: "11px",
                    fontFamily: "var(--font-space-mono)",
                    flexShrink: 0,
                  }}
                >
                  {isOpen ? "▴" : "▾"}
                </span>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div
                  style={{
                    padding: "0 18px 18px",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <StepList track={track} onChange={(steps) => handleSteps(track, steps)} />

                  {/* Name, link, notes — each saves when you leave the field */}
                  <div className="d-form-row" style={{ marginTop: 14 }}>
                    <div className="d-field" style={{ flex: 2 }}>
                      <label>Name</label>
                      <input
                        key={track.name}
                        defaultValue={track.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== track.name) handleField(track, { name: v });
                          else e.target.value = track.name;
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    </div>
                    <div className="d-field" style={{ flex: 3 }}>
                      <label>Course link</label>
                      <input
                        key={track.url ?? ""}
                        type="url"
                        defaultValue={track.url ?? ""}
                        placeholder="https://…"
                        onBlur={(e) => handleLink(track, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    </div>
                  </div>
                  <div className="d-field">
                    <label>Notes</label>
                    <textarea
                      key={track.notes ?? ""}
                      defaultValue={track.notes ?? ""}
                      placeholder="Login details, where you left off, anything worth remembering…"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== track.notes) handleField(track, { notes: v });
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    {track.accent === "amber" ? (
                      <button className="d-btn" onClick={() => handleField(track, { accent: "sky" })}>
                        ☆ remove active focus
                      </button>
                    ) : (
                      <button
                        className="d-btn"
                        onClick={() => handleSetActive(track.id)}
                      >
                        ★ set as active focus
                      </button>
                    )}
                    <button
                      className="d-btn danger"
                      onClick={() => handleDelete(track)}
                      style={{ marginLeft: "auto" }}
                    >
                      delete track
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
