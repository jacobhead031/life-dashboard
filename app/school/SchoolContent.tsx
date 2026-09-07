"use client";

import { useState, useTransition } from "react";
import {
  addSchoolItem,
  deleteSchoolClass,
  deleteSchoolItem,
  saveSchoolClass,
  toggleSchoolItem,
} from "@/app/actions";
import type { SchoolClass, SchoolItem } from "@/lib/types";

const ACCENTS = ["var(--amber)", "var(--sky)", "var(--green)", "var(--coral)"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SchoolContent({ classes, items }: { classes: SchoolClass[]; items: SchoolItem[] }) {
  const [isPending, startTransition] = useTransition();
  const today = new Date();
  const todayStr = localDateStr(today);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Add-item form
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<"assignment" | "exam">("assignment");
  const [dueOn, setDueOn] = useState(todayStr);

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
  for (const it of items) byDate.set(it.due_on, [...(byDate.get(it.due_on) ?? []), it]);

  function handleAddItem() {
    if (!title.trim() || !classId || !dueOn) return;
    const data = { title: title.trim(), class_id: classId, kind, due_on: dueOn };
    setTitle("");
    setShowAdd(false);
    startTransition(() => addSchoolItem(data));
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
                <button className="d-btn danger" disabled={isPending} onClick={() => startTransition(() => deleteSchoolClass(c.id))}>delete</button>
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
              const isToday = (today.getDay() + 6) % 7 === i;
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

        <section className="card span-6">
          <div className="card-label"><span>due · {MONTH_NAMES[m]}</span></div>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="school-day">{d}</div>)}
            {Array.from({ length: cells }, (_, i) => {
              const day = i - offset + 1;
              if (day < 1 || day > daysInMonth) return <div key={i} className="cal-cell blank" />;
              const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return (
                <div key={i} className={`cal-cell${key === todayStr ? " today" : ""}`}>
                  <div className="cal-daynum">{day}</div>
                  {(byDate.get(key) ?? []).map((it) => (
                    <div
                      key={it.id}
                      className={`cal-chip${it.kind === "exam" ? " exam" : ""}${it.done ? " done" : ""}`}
                      style={{ "--chip": accent(it.class_id) } as React.CSSProperties}
                      title={`${clsName(it.class_id)} · click to mark ${it.done ? "not done" : "done"}`}
                      onClick={() => startTransition(() => toggleSchoolItem(it.id, !it.done))}
                    >
                      <span>{it.title}</span>
                      <span className="cal-meta">{clsName(it.class_id)}</span>
                      <button
                        className="cal-x"
                        aria-label="Delete"
                        onClick={(e) => { e.stopPropagation(); startTransition(() => deleteSchoolItem(it.id)); }}
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
