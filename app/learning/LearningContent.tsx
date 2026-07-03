"use client";

import { useState, useTransition } from "react";
import {
  addTrack,
  updateTrack,
  setActiveTrack,
  deleteTrack,
} from "@/app/actions";
import type { LearningTrack } from "@/lib/types";

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

function StepList({
  track,
  onUpdate,
}: {
  track: LearningTrack;
  onUpdate: (n: number) => void;
}) {
  return (
    <div className="steps">
      {Array.from({ length: track.total_steps }, (_, i) => i + 1).map((n) => {
        const done = n <= track.completed_steps;
        const isCurrent = n === track.completed_steps + 1;
        return (
          <div
            key={n}
            className="step-item"
            onClick={() => {
              if (n === track.completed_steps) onUpdate(n - 1);
              else if (n > track.completed_steps) onUpdate(n);
            }}
            role="checkbox"
            aria-checked={done}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                if (n === track.completed_steps) onUpdate(n - 1);
                else if (n > track.completed_steps) onUpdate(n);
              }
            }}
          >
            <div className={`step-check${done ? " done" : ""}`}>
              {done && "✓"}
            </div>
            <span
              className={`step-label${done ? " done" : isCurrent ? " current" : ""}`}
            >
              Step {n}
              {isCurrent && track.current_label
                ? ` — ${track.current_label}`
                : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LearningContent({ tracks }: { tracks: LearningTrack[] }) {
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [totalSteps, setTotalSteps] = useState("5");
  const [currentLabel, setCurrentLabel] = useState("");
  const [accent, setAccent] = useState<"amber" | "sky">("sky");

  // Per-track label edit state
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    setShowAdd(false);
    setName("");
    setTotalSteps("5");
    setCurrentLabel("");
    setAccent("sky");
    await addTrack({
      name: name.trim(),
      total_steps: parseInt(totalSteps) || 5,
      current_label: currentLabel.trim(),
      accent,
    });
  }

  function handleStep(track: LearningTrack, n: number) {
    startTransition(async () => {
      await updateTrack(track.id, { completed_steps: n });
    });
  }

  async function handleSetActive(id: string) {
    await setActiveTrack(id);
  }

  async function handleDelete(track: LearningTrack) {
    if (!confirm(`Delete "${track.name}"?`)) return;
    await deleteTrack(track.id);
  }

  async function saveLabelEdit(track: LearningTrack) {
    setEditingLabel(null);
    if (labelDraft.trim() !== track.current_label) {
      await updateTrack(track.id, { current_label: labelDraft.trim() });
    }
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
        >
          {showAdd ? "✕ cancel" : "+ add track"}
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
                <span
                  style={{
                    color: "var(--muted-2)",
                    fontSize: "11px",
                    fontFamily: "var(--font-space-mono)",
                    marginLeft: "auto",
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
                  <StepList
                    track={track}
                    onUpdate={(n) => handleStep(track, n)}
                  />

                  {/* Current step label edit */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: "12px",
                      background: "var(--base-2)",
                      borderRadius: "9px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-space-mono)",
                        fontSize: "10px",
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "var(--muted-2)",
                        marginBottom: "7px",
                      }}
                    >
                      current step label
                    </div>
                    {editingLabel === track.id ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="inline-input"
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveLabelEdit(track);
                            if (e.key === "Escape") setEditingLabel(null);
                          }}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          className="d-btn"
                          onClick={() => saveLabelEdit(track)}
                        >
                          save
                        </button>
                      </div>
                    ) : (
                      <button
                        className="d-btn"
                        style={{ textTransform: "none", fontSize: "13px" }}
                        onClick={() => {
                          setEditingLabel(track.id);
                          setLabelDraft(track.current_label);
                        }}
                      >
                        {track.current_label || "click to add step label…"}
                      </button>
                    )}
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
                    {track.accent !== "amber" && (
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
