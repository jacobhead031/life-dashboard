"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  addSchoolItem,
  deleteSchoolClass,
  deleteSchoolItem,
  reorderSchoolItem,
  saveSchoolClass,
  toggleSchoolItem,
} from "@/app/actions";
import type { SchoolClass, SchoolItem } from "@/lib/types";
import { addDays, todayStr } from "@/lib/utils";
import { WeekTodo } from "./WeekTodo";

const ACCENTS = ["var(--amber)", "var(--sky)", "var(--green)", "var(--coral)"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function SchoolContent({ classes, items }: { classes: SchoolClass[]; items: SchoolItem[] }) {
  const [isPending, startTransition] = useTransition();
  // Ticks and drags get their own transition so they don't flip the header to "saving…".
  const [, startQuiet] = useTransition();
  // Calendar and weekly to-do both read this, so a check in either shows in both at once.
  const [optItems, patchItem] = useOptimistic(items, (state, patch: Partial<SchoolItem> & { id: string }) =>
    state.map((it) => (it.id === patch.id ? { ...it, ...patch } : it)),
  );
  // Toronto date string, so server and client render the same "today".
  const today = todayStr();
  const todayDow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [month, setMonth] = useState(() => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1));

  // Add-item form
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<"assignment" | "exam">("assignment");
  const [dueOn, setDueOn] = useState(today);

  // Classes panel
  const [showClasses, setShowClasses] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [classDays, setClassDays] = useState<number[]>([]);
  const [classTime, setClassTime] = useState("");

  const accent = (id: string) => ACCENTS[Math.max(0, classes.findIndex((c) => c.id === id)) % ACCENTS.length];
  const clsName = (id: string) => classes.find((c) => c.id === id)?.name ?? "";

  // Calendar grid, Monday-first
  const y = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const byDate = new Map<string, SchoolItem[]>();
  for (const it of optItems) byDate.set(it.due_on, [...(byDate.get(it.due_on) ?? []), it]);

  // Weekly to-do: due within 7 days, plus anything overdue and still unchecked.
  const plus7Str = addDays(today, 7);
  const weekItems = optItems
    .filter((it) => it.due_on <= plus7Str && (it.due_on >= today || !it.done))
    .sort((a, b) => a.position - b.position || a.due_on.localeCompare(b.due_on));

  function toggle(id: string, done: boolean) {
    startQuiet(async () => {
      patchItem({ id, done });
      await toggleSchoolItem(id, done);
    });
  }

  function reorder(id: string, position: number) {
    startQuiet(async () => {
      patchItem({ id, position });
      await reorderSchoolItem(id, position);
    });
  }

  function handleAddItem() {
    if (!title.trim() || !classId || !dueOn) return;
    const data = { title: title.trim(), class_id: classId, kind, due_on: dueOn };
    setTitle("");
    setShowAdd(false);
    startTransition(() => addSchoolItem(data));
  }

  function handleDeleteClass(c: SchoolClass) {
    const n = optItems.filter((it) => it.class_id === c.id).length;
    if (!confirm(`Delete "${c.name}"? This also deletes its ${n} assignment${n === 1 ? "" : "s"}/exam${n === 1 ? "" : "s"}. This can't be undone.`)) return;
    startTransition(() => deleteSchoolClass(c.id));
  }

  function handleDeleteItem(it: SchoolItem) {
    if (!confirm(`Delete "${it.title}"?`)) return;
    startTransition(() => deleteSchoolItem(it.id));
  }

  function openClassForm(c?: SchoolClass) {
    setEditingId(c?.id ?? null);
    setClassName(c?.name ?? "");
    setClassDays(c?.days ?? []);
    setClassTime(c?.start_time?.slice(0, 5) ?? "");
  }

  function handleSaveClass() {
    if (!className.trim()) return;
    const data = {
      ...(editingId ? { id: editingId } : {}),
      name: className.trim(),
      days: [...classDays].sort(),
      start_time: classTime || null,
    };
    openClassForm();
    startTransition(() => saveSchoolClass(data));
  }

  return (
    <>
      <div className="month-nav">
        <button className="month-arrow" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label="Previous month">‹</button>
        <span className="month-nav-label">{MONTH_NAMES[m]} {y}</span>
        <button className="month-arrow" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Next month">›</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => { setShowClasses((v) => !v); openClassForm(); }}>
            {showClasses ? "✕ close classes" : "classes"}
          </button>
          <button className="btn primary" onClick={() => setShowAdd((v) => !v)} disabled={isPending}>
            {isPending ? "saving…" : showAdd ? "✕ cancel" : "+ add assignment / exam"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="add-panel">
          {classes.length === 0 ? (
            <div className="empty-state"><p>Add a class first — every assignment belongs to one.</p></div>
          ) : (
            <>
              <div className="d-form-row">
                <div className="d-field" style={{ flex: 3 }}>
                  <label>Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Problem set 3" autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddItem()} />
                </div>
                <div className="d-field">
                  <label>Class</label>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                    <option value="">choose…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="d-field">
                  <label>Type</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value as "assignment" | "exam")}>
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
                <div className="d-field">
                  <label>Due</label>
                  <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
                </div>
              </div>
              <div className="d-form-actions">
                <button className="btn primary" onClick={handleAddItem} disabled={!title.trim() || !classId || !dueOn}>Add</button>
                <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {showClasses && (
        <div className="add-panel">
          <div className="add-panel-title">classes</div>
          {classes.map((c) => (
            <div key={c.id} className="school-class-row">
              <span className="cal-dot" style={{ background: accent(c.id) }} />
              <span style={{ fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: "var(--muted-2)", fontSize: 12.5 }}>
                {c.days.map((d) => DOW[d - 1]).join(" ")}{c.start_time && ` · ${c.start_time.slice(0, 5)}`}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="d-btn" onClick={() => openClassForm(c)}>edit</button>
                <button className="d-btn danger" disabled={isPending} onClick={() => handleDeleteClass(c)}>delete</button>
              </span>
            </div>
          ))}
          <div className="d-form-row" style={{ marginTop: 14 }}>
            <div className="d-field" style={{ flex: 2 }}>
              <label>{editingId ? "Edit class" : "New class"}</label>
              <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. BIO 130" onKeyDown={(e) => e.key === "Enter" && handleSaveClass()} />
            </div>
            <div className="d-field" style={{ flex: 3 }}>
              <label>Meets on</label>
              <div className="school-days">
                {DOW.map((d, i) => (
                  <label key={d} className={classDays.includes(i + 1) ? "on" : ""}>
                    <input type="checkbox" checked={classDays.includes(i + 1)}
                      onChange={(e) => setClassDays((ds) => e.target.checked ? [...ds, i + 1] : ds.filter((x) => x !== i + 1))} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="d-field">
              <label>Starts</label>
              <input type="time" value={classTime} onChange={(e) => setClassTime(e.target.value)} />
            </div>
          </div>
          <div className="d-form-actions">
            <button className="btn primary" onClick={handleSaveClass} disabled={!className.trim() || isPending}>
              {editingId ? "Save" : "Add class"}
            </button>
            {editingId && <button className="btn" onClick={() => openClassForm()}>Cancel edit</button>}
          </div>
        </div>
      )}

      <div className="grid-bento">
        <section className="card span-6">
          <div className="card-label"><span>this week&rsquo;s classes</span></div>
          <div className="school-week">
            {DOW.map((d, i) => {
              const here = classes.filter((c) => c.days.includes(i + 1));
              const isToday = todayDow === i;
              return (
                <div key={d}>
                  <div className={`school-day${isToday ? " today" : ""}`}>{d}</div>
                  {here.map((c) => (
                    <div key={c.id} className="cal-chip" style={{ "--chip": accent(c.id) } as React.CSSProperties}>
                      {c.name}{c.start_time && <span className="cal-meta">{c.start_time.slice(0, 5)}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <WeekTodo items={weekItems} accent={accent} clsName={clsName} todayStr={today} onToggle={toggle} onReorder={reorder} />

        <section className="card span-6">
          <div className="card-label"><span>due · {MONTH_NAMES[m]}</span></div>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="school-day">{d}</div>)}
            {Array.from({ length: cells }, (_, i) => {
              const day = i - offset + 1;
              if (day < 1 || day > daysInMonth) return <div key={i} className="cal-cell blank" />;
              const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return (
                <div key={i} className={`cal-cell${key === today ? " today" : ""}`}>
                  <div className="cal-daynum">{day}</div>
                  {(byDate.get(key) ?? []).map((it) => (
                    <div
                      key={it.id}
                      className={`cal-chip${it.kind === "exam" ? " exam" : ""}${it.done ? " done" : ""}`}
                      style={{ "--chip": accent(it.class_id) } as React.CSSProperties}
                      title={`${clsName(it.class_id)} · click to mark ${it.done ? "not done" : "done"}`}
                      onClick={() => toggle(it.id, !it.done)}
                      role="checkbox"
                      aria-checked={it.done}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        // Own keys only, so Enter on the nested × still deletes.
                        if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
                          e.preventDefault();
                          toggle(it.id, !it.done);
                        }
                      }}
                    >
                      <span>{it.title}</span>
                      <span className="cal-meta">{clsName(it.class_id)}</span>
                      <button
                        className="cal-x"
                        aria-label={`Delete ${it.title}`}
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(it); }}
                      >×</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
