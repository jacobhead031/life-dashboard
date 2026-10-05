"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toggleWeeklyGoal, addWeeklyGoal, deleteWeeklyGoal, reorderWeeklyGoal, setWeeklyGoalProgress } from "@/app/actions";
import type { WeeklyGoal } from "@/lib/types";

// One draggable row: handle on the left, the goal itself as children.
function SortableGoal({ goal, children }: { goal: WeeklyGoal; children: React.ReactNode }) {
  const isTemp = goal.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: goal.id, disabled: { draggable: isTemp, droppable: isTemp } });
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: isTemp ? 0.6 : isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}),
      }}
    >
      <span className="todo-drag-handle" {...attributes} {...listeners} aria-label={`Move ${goal.text}`}>⠿</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function WeeklyGoalsCard({
  goals: serverGoals,
  weekStr,
}: {
  goals: WeeklyGoal[];
  weekStr: string;
}) {
  const [unsorted, setGoals] = useState(serverGoals);
  const goals = [...unsorted].sort((a, b) => a.position - b.position);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Sync when server re-renders deliver fresh data
  useEffect(() => { setGoals(serverGoals); }, [serverGoals]);

  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    const target = parseInt(targetDraft) || 0;
    const temp: WeeklyGoal = {
      id: "temp-" + crypto.randomUUID(),
      user_id: "", text, week: weekStr,
      done: false, target, current: 0, created_at: "",
      position: Math.max(0, ...goals.map((g) => g.position)) + 1,
    };
    setDraft("");
    setTargetDraft("");
    setGoals((prev) => [...prev, temp]);
    startTransition(async () => { await addWeeklyGoal(text, weekStr, target); });
  }

  function handleToggle(g: WeeklyGoal) {
    setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, done: !x.done } : x));
    startTransition(async () => { await toggleWeeklyGoal(g.id, !g.done); });
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => { await deleteWeeklyGoal(id); });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = goals.findIndex((g) => g.id === active.id);
    const to = goals.findIndex((g) => g.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(goals, from, to);
    const prevPos = moved[to - 1]?.position;
    const nextPos = moved[to + 1]?.position;
    const position =
      prevPos !== undefined && nextPos !== undefined ? (prevPos + nextPos) / 2
      : prevPos !== undefined ? prevPos + 1
      : nextPos !== undefined ? nextPos - 1
      : 0;
    const id = String(active.id);
    setGoals((prev) => prev.map((x) => x.id === id ? { ...x, position } : x));
    startTransition(async () => { await reorderWeeklyGoal(id, position); });
  }

  function handleProgress(g: WeeklyGoal, delta: number) {
    const next = Math.max(0, g.current + delta);
    setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, current: next, done: next >= x.target } : x));
    startTransition(async () => { await setWeeklyGoalProgress(g.id, next, g.target); });
  }

  const done = goals.filter((g) => g.target > 0 ? g.current >= g.target : g.done).length;
  const weekLabel = new Date(weekStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <section className="card span-6" style={{ animationDelay: ".05s" }}>
      <div className="card-label">
        <span>this week · {weekLabel}{goals.length > 0 ? ` · ${done}/${goals.length}` : ""}</span>
      </div>

      <DndContext id="weekly-goals-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
      {goals.map((g) => (
        <SortableGoal key={g.id} goal={g}>
          {g.target > 0 ? (
            /* ── Progress goal ── */
            <div className={`mgoal${g.current >= g.target ? " done" : ""}`} style={{ display: "flex", alignItems: "center", cursor: "default" }}>
              <span className="box">{g.current >= g.target ? "✓" : ""}</span>
              <span className="m-text" style={{ flex: 1 }}>{g.text}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                <button
                  className="d-btn"
                  style={{ padding: "1px 8px", fontSize: "16px", lineHeight: 1 }}
                  onClick={() => handleProgress(g, -1)}
                  disabled={isPending || g.current <= 0}
                >−</button>
                <span style={{ fontFamily: "var(--font-space-mono)", fontSize: "12px", minWidth: 36, textAlign: "center" }}>
                  {g.current}/{g.target}
                </span>
                <button
                  className="d-btn"
                  style={{ padding: "1px 8px", fontSize: "16px", lineHeight: 1 }}
                  onClick={() => handleProgress(g, 1)}
                  disabled={isPending || g.current >= g.target}
                >+</button>
              </div>
              <button
                className="d-btn danger"
                style={{ marginLeft: 8, opacity: 0.4, fontSize: "11px", padding: "2px 6px" }}
                onClick={() => handleDelete(g.id)}
                disabled={g.id.startsWith("temp-")}
                aria-label={`Delete ${g.text}`}
              >✕</button>
            </div>
          ) : (
            /* ── Checkbox goal ── */
            <div
              className={`mgoal${g.done ? " done" : ""}`}
              style={{ display: "flex", alignItems: "center", cursor: isPending ? "wait" : "pointer" }}
              onClick={() => !isPending && !g.id.startsWith("temp-") && handleToggle(g)}
              role="checkbox"
              aria-checked={g.done}
              tabIndex={0}
              onKeyDown={(e) => {
                // Own keys only, so Enter on the nested ✕ still deletes.
                if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter") && !isPending && !g.id.startsWith("temp-")) {
                  e.preventDefault();
                  handleToggle(g);
                }
              }}
            >
              <span className="box">{g.done ? "✓" : ""}</span>
              <span className="m-text" style={{ flex: 1 }}>{g.text}</span>
              <button
                className="d-btn danger"
                style={{ marginLeft: 8, opacity: 0.4, fontSize: "11px", padding: "2px 6px" }}
                onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                disabled={g.id.startsWith("temp-")}
                aria-label={`Delete ${g.text}`}
              >✕</button>
            </div>
          )}
        </SortableGoal>
      ))}
      </SortableContext>
      </DndContext>

      {/* Add row */}
      {showAdd ? (
        <div className="quick-add-row" style={{ marginTop: goals.length ? 8 : 0, display: "flex", gap: 8 }}>
          <input
            ref={textRef}
            className="quick-add-input"
            style={{ flex: 1 }}
            placeholder="goal name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={isPending}
            autoFocus
          />
          <input
            className="quick-add-input"
            style={{ width: 80 }}
            type="number"
            min={0}
            placeholder="target?"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={isPending}
          />
          <button className="btn" aria-label="Cancel" onClick={() => { setShowAdd(false); setDraft(""); setTargetDraft(""); }}>
            ✕
          </button>
        </div>
      ) : (
        <button
          className="d-btn"
          style={{ marginTop: goals.length ? 8 : 0 }}
          onClick={() => setShowAdd(true)}
        >
          + add goal
        </button>
      )}
    </section>
  );
}
