"use client";

import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SchoolItem } from "@/lib/types";
import { daysBetween } from "@/lib/utils";

// Sunday-first to index Date#getDay — SchoolContent's DOW is Monday-first.
const DOW_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type RowProps = {
  item: SchoolItem;
  accent: string;
  clsName: string;
  todayStr: string;
  onToggle: (id: string, done: boolean) => void;
};

function dueLabel(dueOn: string, todayStr: string): { text: string; tone: string } {
  const days = daysBetween(todayStr, dueOn);
  const dow = DOW_SUN[new Date(`${dueOn}T00:00:00Z`).getUTCDay()];
  if (days < 0) return { text: `overdue · ${dow}`, tone: " overdue" };
  if (days === 0) return { text: "today", tone: " today" };
  if (days === 1) return { text: "tomorrow", tone: "" };
  return { text: `${dow} · in ${days}d`, tone: "" };
}

function RowBody({ item, accent, clsName, todayStr, onToggle }: RowProps) {
  const due = dueLabel(item.due_on, todayStr);
  return (
    <>
      <input
        type="checkbox"
        className="todo-check"
        checked={item.done}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        aria-label={`Mark ${item.title} ${item.done ? "not done" : "done"}`}
      />
      <span className="cal-dot" style={{ background: accent, marginTop: 7 }} />
      <div className="note-stream-body">
        {item.title}
        {item.kind === "exam" && <span className="todo-tag">exam</span>}
        <span className="todo-class">{clsName}</span>
      </div>
      <div className={`note-stream-time todo-due${item.done ? "" : due.tone}`}>{due.text}</div>
    </>
  );
}

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  return (
    <div
      ref={setNodeRef}
      className="note-stream-item"
      style={{
        opacity: isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}),
      }}
    >
      <span className="todo-drag-handle" {...attributes} {...listeners}>⠿</span>
      <RowBody {...props} />
    </div>
  );
}

export function WeekTodo({
  items,
  accent,
  clsName,
  todayStr,
  onToggle,
  onReorder,
}: {
  items: SchoolItem[]; // already filtered to the window and sorted by position
  accent: (classId: string) => string;
  clsName: (classId: string) => string;
  todayStr: string;
  onToggle: (id: string, done: boolean) => void;
  onReorder: (id: string, position: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = open.findIndex((i) => i.id === active.id);
    const to = open.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(open, from, to);
    const prevPos = moved[to - 1]?.position;
    const nextPos = moved[to + 1]?.position;
    const position =
      prevPos !== undefined && nextPos !== undefined ? (prevPos + nextPos) / 2
      : prevPos !== undefined ? prevPos + 1
      : nextPos !== undefined ? nextPos - 1
      : 0;
    onReorder(String(active.id), position);
  }

  const row = (i: SchoolItem) => ({ item: i, accent: accent(i.class_id), clsName: clsName(i.class_id), todayStr, onToggle });

  return (
    <section className="card span-6">
      <div className="card-label">
        <span>to do · next 7 days</span>
        {items.length > 0 && <span>{done.length}/{items.length}</span>}
      </div>
      {items.length === 0 && <div className="empty-state"><p>Nothing due in the next 7 days.</p></div>}
      <DndContext id="school-todo-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={open.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {open.map((i) => <SortableRow key={i.id} {...row(i)} />)}
        </SortableContext>
      </DndContext>
      {done.map((i) => (
        <div key={i.id} className="note-stream-item done">
          <span className="todo-drag-handle" style={{ visibility: "hidden" }}>⠿</span>
          <RowBody {...row(i)} />
        </div>
      ))}
    </section>
  );
}
