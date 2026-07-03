"use client";

import { useState, useTransition } from "react";
import { addTarget, updateTarget, deleteTarget } from "@/app/actions";
import type { Target } from "@/lib/types";

function TargetBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
  return (
    <div className="bar" style={{ margin: "8px 0" }}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

function TargetEditor({
  target,
  onSave,
  onCancel,
}: {
  target: Target;
  onSave: (current: number, goal: number) => void;
  onCancel: () => void;
}) {
  const [current, setCurrent] = useState(String(target.current));
  const [goal, setGoal] = useState(String(target.goal));

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginTop: 10,
        padding: "12px",
        background: "var(--base-2)",
        borderRadius: "9px",
      }}
    >
      <div className="d-field" style={{ minWidth: 90, flex: "0 0 auto" }}>
        <label>{target.kind === "count" ? "current" : "best"}</label>
        <input
          type="number"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          min={0}
          autoFocus
          onKeyDown={(e) =>
            e.key === "Enter" &&
            onSave(parseFloat(current) || 0, parseFloat(goal) || 0)
          }
        />
      </div>
      <div className="d-field" style={{ minWidth: 90, flex: "0 0 auto" }}>
        <label>goal</label>
        <input
          type="number"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          min={0}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            onSave(parseFloat(current) || 0, parseFloat(goal) || 0)
          }
        />
      </div>
      <button
        className="btn primary"
        onClick={() =>
          onSave(parseFloat(current) || 0, parseFloat(goal) || 0)
        }
        style={{ marginBottom: 1 }}
      >
        Save
      </button>
      <button className="btn" onClick={onCancel} style={{ marginBottom: 1 }}>
        Cancel
      </button>
    </div>
  );
}

export function TargetsContent({
  targets,
  currentYear,
}: {
  targets: Target[];
  currentYear: number;
}) {
  const [year, setYear] = useState(currentYear);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"count" | "best">("count");
  const [goal, setGoal] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  const allYears = Array.from(
    new Set([currentYear, ...targets.map((t) => t.year)])
  ).sort((a, b) => b - a);

  const filtered = targets.filter((t) => t.year === year);

  function handleAdd() {
    if (!name.trim() || !goal) return;
    const data = { name: name.trim(), kind, goal: parseFloat(goal) || 0, unit: unit.trim() || null, year };
    setShowAdd(false);
    setName("");
    setKind("count");
    setGoal("");
    setUnit("");
    startTransition(async () => {
      await addTarget(data);
    });
  }

  async function handleSave(target: Target, current: number, g: number) {
    setEditingId(null);
    await updateTarget(target.id, current, g);
  }

  async function handleDelete(target: Target) {
    if (!confirm(`Delete "${target.name}"?`)) return;
    await deleteTarget(target.id);
  }

  return (
    <div>
      {/* Year switcher + add button */}
      <div className="detail-top-row">
        <div className="year-switch">
          {allYears.map((y) => (
            <button
              key={y}
              className={`year-btn${year === y ? " active" : ""}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={isPending}
        >
          {showAdd ? "✕ cancel" : "+ add target"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new target · {year}</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 3 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bike 180 km in one day"
                autoFocus
              />
            </div>
            <div className="d-field">
              <label>Type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "count" | "best")}
              >
                <option value="count">Count</option>
                <option value="best">Best</option>
              </select>
            </div>
          </div>
          <div className="d-form-row">
            <div className="d-field">
              <label>Goal</label>
              <input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. 5"
                min={0}
              />
            </div>
            <div className="d-field">
              <label>Unit (optional)</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. songs, km"
              />
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!name.trim() || !goal}
            >
              Add target
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Target list */}
      {filtered.length === 0 ? (
        <div className="card-full" style={{ padding: "22px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            No targets for {year}. Add one above.
          </p>
        </div>
      ) : (
        filtered.map((target) => {
          const pct =
            target.goal > 0
              ? Math.min(
                  Math.round((target.current / target.goal) * 100),
                  100
                )
              : 0;
          const isEditing = editingId === target.id;

          return (
            <div
              key={target.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "18px 22px",
                marginBottom: 14,
              }}
            >
              <div className="t-top">
                <div>
                  <div className="t-name">{target.name}</div>
                  <div className="t-val" style={{ marginTop: 3 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-space-mono)",
                        fontSize: "10px",
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "var(--muted-2)",
                        marginRight: 6,
                      }}
                    >
                      {target.kind}
                    </span>
                    <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                      {target.current}
                    </span>
                    {" / "}
                    {target.goal}
                    {target.unit && ` ${target.unit}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: "13px",
                      color: pct >= 100 ? "var(--green)" : "var(--text)",
                    }}
                  >
                    {pct}%
                  </span>
                  <button
                    className="d-btn"
                    onClick={() =>
                      setEditingId(isEditing ? null : target.id)
                    }
                  >
                    edit
                  </button>
                  <button
                    className="d-btn danger"
                    onClick={() => handleDelete(target)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <TargetBar current={target.current} goal={target.goal} />

              {isEditing && (
                <TargetEditor
                  target={target}
                  onSave={(c, g) => handleSave(target, c, g)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
