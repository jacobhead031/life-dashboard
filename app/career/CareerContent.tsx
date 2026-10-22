"use client";

import { useOptimistic, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CareerApp, CareerContact, CareerTodo, CareerWin } from "@/lib/types";
import { APP_STATUSES, CONTACT_STAGES, GATES, STANDING, WEEKLY_MESSAGE_TARGET, currentGate, salesExpMonths, scorecard } from "@/lib/career";
import { addDays, weekMonday } from "@/lib/utils";
import {
  addCareerApp, addCareerContact, addCareerTodo, addCareerWin, deleteCareerApp, deleteCareerContact, deleteCareerTodo, deleteCareerWin,
  reorderCareerApp, reorderCareerTodo, saveCareerApp, saveCareerContact, seedCareer, setSalesExpSince, toggleCareerTodo, type CareerAppEdit, type CareerContactEdit,
} from "@/app/actions";

const STATUS_LABEL: Record<string, string> = { to_apply: "to apply", applied: "applied", interview: "interview", offer: "offer", watch: "watch", closed: "closed" };
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function CareerContent({ todos: serverTodos, apps, contacts, wins, salesExpSince, todayStr: today, weekStr }: {
  todos: CareerTodo[]; apps: CareerApp[]; contacts: CareerContact[]; wins: CareerWin[]; salesExpSince: string | null; todayStr: string; weekStr: string;
}) {
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<void>) => startTransition(async () => { await fn(); });
  // Open ones in drag order, done ones sink to the bottom.
  const [todosRaw, patchTodo] = useOptimistic(serverTodos, (list, p: Partial<CareerTodo> & { id: string }) => list.map((t) => (t.id === p.id ? { ...t, ...p } : t)));
  const todos = [...todosRaw].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);
  const openTodos = todos.filter((t) => !t.done);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = openTodos.findIndex((t) => t.id === active.id);
    const to = openTodos.findIndex((t) => t.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(openTodos, from, to);
    const prev = moved[to - 1]?.position;
    const next = moved[to + 1]?.position;
    const position = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : 0;
    startTransition(async () => { patchTodo({ id: String(active.id), position }); await reorderCareerTodo(String(active.id), position); });
  }
  const gate = currentGate(today);
  const score = scorecard(contacts, weekStr, today, weekMonday, addDays);
  // Ranked: open rows in drag order (1 = apply first); offers and closed rows sit below, unnumbered.
  const [appsRaw, patchApp] = useOptimistic(apps, (list, p: Partial<CareerApp> & { id: string }) => list.map((a) => (a.id === p.id ? { ...a, ...p } : a)));
  const ranked = appsRaw.filter((a) => !["closed", "offer"].includes(a.status)).sort((a, b) => a.position - b.position);
  const parked = appsRaw.filter((a) => ["closed", "offer"].includes(a.status));
  const open = appsRaw.filter((a) => a.status !== "closed");
  function onAppDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ranked.findIndex((a) => a.id === active.id);
    const to = ranked.findIndex((a) => a.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(ranked, from, to);
    const prev = moved[to - 1]?.position;
    const next = moved[to + 1]?.position;
    const position = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : 0;
    startTransition(async () => { patchApp({ id: String(active.id), position }); await reorderCareerApp(String(active.id), position); });
  }
  const live = contacts.filter((c) => !c.do_not_contact);

  if (apps.length === 0 && contacts.length === 0 && todos.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "72px 0" }}>
        <p>Nothing here yet.</p>
        <button type="button" className="btn primary" disabled={isPending} onClick={() => run(() => seedCareer(weekStr))}>{isPending ? "loading…" : "load the plan"}</button>
      </div>
    );
  }

  return (
    <div className="grid-bento career">
      {/* ── This week ── */}
      <section className="card span-3">
        <div className="card-label"><span>this week · {shortDate(weekStr)}</span><span className="card-nav">{todos.filter((t) => t.done).length}/{todos.length} · do them in order</span></div>
        {todos.length === 0 && <div className="empty-state"><p>No priorities yet. The Sunday agent writes them; add your own below.</p></div>}
        <DndContext id="career-todo-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={openTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {openTodos.map((t, n) => <TodoRow key={t.id} t={t} n={n + 1} sortable busy={isPending} toggle={(on) => startTransition(async () => { patchTodo({ id: t.id, done: on }); await toggleCareerTodo(t.id, on); })} remove={() => run(() => deleteCareerTodo(t.id))} />)}
          </SortableContext>
        </DndContext>
        {todos.filter((t) => t.done).map((t) => <TodoRow key={t.id} t={t} busy={isPending} toggle={(on) => startTransition(async () => { patchTodo({ id: t.id, done: on }); await toggleCareerTodo(t.id, on); })} remove={() => run(() => deleteCareerTodo(t.id))} />)}
        <QuickAdd placeholder="add a priority" busy={isPending} submit={(text) => run(() => addCareerTodo(weekStr, text))} />
        <div className="career-standing">
          <div className="life-kicker" style={{ color: "var(--muted-2)" }}>every week</div>
          {STANDING.map((t) => <div key={t} className="career-standing-item">{t}</div>)}
        </div>
      </section>

      {/* ── Gates + scorecard ── */}
      <section className="card span-3">
        <div className="card-label"><span>gates</span><span className="card-nav">{gate.name}</span></div>
        <div className="career-gates">
          {GATES.map((g) => (
            <div key={g.key} className={`career-gate${g.key === gate.key ? " now" : today > g.end ? " past" : ""}`} title={g.gate}>
              <span className="career-gate-name">{g.name}</span>
              <span className="career-gate-text">{g.gate}</span>
            </div>
          ))}
        </div>
        <div className="career-stats">
          <Stat n={salesExpMonths(salesExpSince, today)} label="months sales-facing" />
          <Stat n={`${score.sentThisWeek}/${WEEKLY_MESSAGE_TARGET}`} label="messages this week" />
          <Stat n={score.followupsDue} label="follow-ups due" warn={score.followupsDue > 0} />
          <Stat n={score.sent ? `${Math.round((score.replies / score.sent) * 100)}%` : "–"} label="reply rate" />
          <Stat n={score.streak} label="week streak" />
        </div>
        <label className="career-since">
          sales-facing experience since
          <input type="date" className="dates-date" value={salesExpSince ?? ""} max={today} disabled={isPending} onChange={(e) => run(() => setSalesExpSince(e.target.value || null))} />
        </label>
      </section>

      {/* ── Pipeline ── */}
      <section className="card span-6">
        <div className="card-label"><span>applications</span><span className="card-nav">{open.length} open</span></div>
        <DndContext id="career-app-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onAppDragEnd}>
          <SortableContext items={ranked.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {ranked.map((a, n) => <AppRow key={a.id} app={a} rank={n + 1} today={today} busy={isPending} save={(f) => run(() => saveCareerApp(a.id, f))} remove={() => run(() => deleteCareerApp(a.id))} />)}
          </SortableContext>
        </DndContext>
        {parked.map((a) => <AppRow key={a.id} app={a} today={today} busy={isPending} save={(f) => run(() => saveCareerApp(a.id, f))} remove={() => run(() => deleteCareerApp(a.id))} />)}
        <AppForm busy={isPending} submit={(f) => run(() => addCareerApp(f))} />
      </section>

      {/* ── Outreach ── */}
      <section className="card span-6">
        <div className="card-label"><span>outreach</span><span className="card-nav">{live.filter((c) => c.stage === "sent").length} waiting · {live.filter((c) => c.stage === "drafted").length} drafted</span></div>
        {contacts.map((c) => <ContactRow key={c.id} c={c} today={today} busy={isPending} save={(f) => run(() => saveCareerContact(c.id, f))} remove={() => run(() => deleteCareerContact(c.id))} />)}
        <ContactForm busy={isPending} submit={(f) => run(() => addCareerContact(f))} />
      </section>

      {/* ── Brag book ── */}
      <section className="card span-6">
        <div className="card-label"><span>brag book</span><span className="card-nav">{wins.length}</span></div>
        {wins.map((w) => (
          <div key={w.id} className="note-stream-item">
            <div className="note-stream-body">{w.text}{w.metric && <span className="todo-tag">{w.metric}</span>}</div>
            <div className="note-stream-time">{w.happened_on ? shortDate(w.happened_on) : ""}</div>
            <button type="button" className="d-btn danger dates-x" aria-label="Delete" disabled={isPending} onClick={() => run(() => deleteCareerWin(w.id))}>✕</button>
          </div>
        ))}
        <form className="quick-add-row" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const text = String(f.get("text")).trim(); if (!text) return; run(() => addCareerWin(text, String(f.get("metric")) || null, String(f.get("on")) || null)); e.currentTarget.reset(); }}>
          <input className="quick-add-input" name="text" placeholder="a win (with a number if there is one)" maxLength={500} required />
          <input className="quick-add-input career-metric" name="metric" placeholder="number" maxLength={100} />
          <input className="quick-add-input career-metric" name="on" type="date" max={today} />
          <button type="submit" className="btn" disabled={isPending}>add</button>
        </form>
      </section>
    </div>
  );
}

function TodoRow({ t, n, sortable = false, busy, toggle, remove }: { t: CareerTodo; n?: number; sortable?: boolean; busy: boolean; toggle: (on: boolean) => void; remove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !sortable });
  return (
    <div ref={setNodeRef} className={`note-stream-item${t.done ? " done" : ""}`} style={{ opacity: isDragging ? 0.7 : 1, transform: CSS.Transform.toString(transform), transition, ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}) }}>
      <span className="todo-drag-handle" style={sortable ? undefined : { visibility: "hidden" }} {...(sortable ? { ...attributes, ...listeners } : {})}>⠿</span>
      <span className="career-rank">{n ?? ""}</span>
      <input type="checkbox" className="todo-check" checked={t.done} disabled={busy} onChange={(e) => toggle(e.target.checked)} aria-label={t.text} />
      <div className={`note-stream-body${n === 1 ? " career-next-row" : ""}`}>{t.text}</div>
      <button type="button" className="d-btn danger dates-x" aria-label="Delete" disabled={busy} onClick={remove}>✕</button>
    </div>
  );
}

function Stat({ n, label, warn }: { n: number | string; label: string; warn?: boolean }) {
  return (
    <div className="career-stat">
      <div className="stat-num" style={warn ? { color: "var(--coral)" } : undefined}>{n}</div>
      <div className="stat-sub">{label}</div>
    </div>
  );
}

function QuickAdd({ placeholder, busy, submit }: { placeholder: string; busy: boolean; submit: (text: string) => void }) {
  return (
    <form className="quick-add-row" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const text = String(new FormData(f).get("text")).trim(); if (!text) return; submit(text); f.reset(); }}>
      <input className="quick-add-input" name="text" placeholder={placeholder} maxLength={500} required />
      <button type="submit" className="btn" disabled={busy}>add</button>
    </form>
  );
}

// ── Applications ──
function AppRow({ app: a, rank, today, busy, save, remove }: { app: CareerApp; rank?: number; today: string; busy: boolean; save: (f: CareerAppEdit) => void; remove: () => void }) {
  const [editing, setEditing] = useState(false);
  const sortable = rank !== undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id, disabled: !sortable });
  if (editing) return <AppForm busy={busy} app={a} submit={(f) => { save(f); setEditing(false); }} cancel={() => setEditing(false)} />;
  return (
    <div ref={setNodeRef} className={`note-stream-item career-row${a.status === "closed" ? " done" : ""}`} style={{ opacity: isDragging ? 0.7 : 1, transform: CSS.Transform.toString(transform), transition, ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}) }}>
      <span className="todo-drag-handle" style={sortable ? undefined : { visibility: "hidden" }} {...(sortable ? { ...attributes, ...listeners } : {})}>⠿</span>
      <span className="career-rank">{rank ?? ""}</span>
      <select className="dates-date career-select" value={a.status} disabled={busy} aria-label="Status" onChange={(e) => save({ status: e.target.value, ...(e.target.value === "applied" && !a.applied_on ? { applied_on: today } : {}) })}>
        {APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <div className="note-stream-body">
        <button type="button" className="career-title" onClick={() => setEditing(true)}>{a.role}</button>
        <span className="todo-class">{a.company}{a.location ? ` · ${a.location}` : ""}{a.term ? ` · ${a.term}` : ""}</span>
        {a.notes && <div className="career-note">{a.notes}</div>}
        {a.url && <a className="dates-link" href={a.url} target="_blank" rel="noreferrer">posting ↗</a>}
      </div>
      <div className="note-stream-time">{a.applied_on ? `applied ${shortDate(a.applied_on)}` : a.source === "agent" ? "found by agent" : ""}</div>
      <button type="button" className="d-btn danger dates-x" aria-label="Delete" disabled={busy} onClick={remove}>✕</button>
    </div>
  );
}

function AppForm({ busy, app, submit, cancel }: { busy: boolean; app?: CareerApp; submit: (f: CareerAppEdit) => void; cancel?: () => void }) {
  const [openForm, setOpenForm] = useState(!!app);
  if (!openForm) return <button type="button" className="empty-link career-add" onClick={() => setOpenForm(true)}>+ add a role</button>;
  const v = (k: string, f: FormData) => String(f.get(k) ?? "");
  return (
    <form className="add-panel career-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); submit({ role: v("role", f), company: v("company", f), location: v("location", f) || null, term: v("term", f) || null, status: v("status", f), url: v("url", f) || null, notes: v("notes", f) || null, applied_on: v("applied_on", f) || null, heard_on: v("heard_on", f) || null }); if (!app) setOpenForm(false); }}>
      <div className="dates-grid">
        <div className="d-field"><label>role</label><input name="role" required maxLength={200} defaultValue={app?.role} /></div>
        <div className="d-field"><label>company</label><input name="company" required maxLength={200} defaultValue={app?.company} /></div>
        <div className="d-field"><label>location</label><input name="location" maxLength={200} defaultValue={app?.location ?? ""} /></div>
        <div className="d-field"><label>term</label><input name="term" maxLength={200} defaultValue={app?.term ?? ""} placeholder="Summer 2027, 4 months" /></div>
        <div className="d-field"><label>status</label><select name="status" defaultValue={app?.status ?? "to_apply"}>{APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        <div className="d-field"><label>applied on</label><input name="applied_on" type="date" defaultValue={app?.applied_on ?? ""} /></div>
        <div className="d-field"><label>heard back</label><input name="heard_on" type="date" defaultValue={app?.heard_on ?? ""} /></div>
        <div className="d-field"><label>link</label><input name="url" type="url" defaultValue={app?.url ?? ""} placeholder="https://" /></div>
      </div>
      <div className="d-field"><label>notes</label><textarea name="notes" maxLength={2000} defaultValue={app?.notes ?? ""} /></div>
      <div className="gd-actions">
        <button type="submit" className="btn primary" disabled={busy}>{app ? "save" : "add"}</button>
        <button type="button" className="d-btn" onClick={() => { setOpenForm(false); cancel?.(); }}>cancel</button>
      </div>
    </form>
  );
}

// ── Outreach ──
function ContactRow({ c, today, busy, save, remove }: { c: CareerContact; today: string; busy: boolean; save: (f: CareerContactEdit) => void; remove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  if (editing) return <ContactForm busy={busy} c={c} submit={(f) => { save(f); setEditing(false); }} cancel={() => setEditing(false)} />;
  const overdue = c.next_followup && c.next_followup <= today && c.stage === "sent";
  async function copyDraft() {
    try { await navigator.clipboard.writeText(c.draft ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setShowDraft(true); }
  }
  return (
    <div className={`note-stream-item career-row${c.do_not_contact ? " done" : ""}`}>
      <select className="dates-date career-select" value={c.stage} disabled={busy || c.do_not_contact} aria-label="Stage" onChange={(e) => {
        const stage = e.target.value;
        // Marking sent stamps the date and queues a follow-up a week out; a reply clears it.
        save(stage === "sent" && !c.sent_on ? { stage, sent_on: today, last_touch: today, next_followup: addDays(today, 7) } : ["replied", "call", "shadow"].includes(stage) ? { stage, last_touch: today, next_followup: null } : { stage });
      }}>
        {CONTACT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="note-stream-body">
        <button type="button" className="career-title" onClick={() => setEditing(true)}>{c.name}</button>
        <span className="todo-class">{[c.role, c.company].filter(Boolean).join(" · ")}</span>
        {c.do_not_contact && <span className="todo-tag">do not contact</span>}
        {c.source === "agent" && <span className="todo-tag">agent</span>}
        {c.why && <div className="career-note">{c.why}</div>}
        <div className="career-links">
          {c.linkedin_url && <a className="dates-link" href={c.linkedin_url} target="_blank" rel="noreferrer">linkedin ↗</a>}
          {c.email && <span className="career-email">{c.email}</span>}
          {c.draft && <button type="button" className="dates-link career-linkbtn" onClick={copyDraft}>{copied ? "copied" : `copy ${c.channel === "email" ? "email" : "note"}`}</button>}
          {c.draft && <button type="button" className="dates-link career-linkbtn" onClick={() => setShowDraft((s) => !s)}>{showDraft ? "hide" : "show"}</button>}
        </div>
        {showDraft && c.draft && <pre className="career-draft">{c.draft}</pre>}
      </div>
      <div className={`note-stream-time${overdue ? " overdue" : ""}`}>
        {overdue ? `follow up · due ${shortDate(c.next_followup!)}` : c.next_followup && c.stage === "sent" ? `follow up ${shortDate(c.next_followup)}` : c.last_touch ? `touched ${shortDate(c.last_touch)}` : ""}
      </div>
      <button type="button" className="d-btn danger dates-x" aria-label="Delete" disabled={busy} onClick={remove}>✕</button>
    </div>
  );
}

function ContactForm({ busy, c, submit, cancel }: { busy: boolean; c?: CareerContact; submit: (f: CareerContactEdit) => void; cancel?: () => void }) {
  const [openForm, setOpenForm] = useState(!!c);
  if (!openForm) return <button type="button" className="empty-link career-add" onClick={() => setOpenForm(true)}>+ add a person</button>;
  const v = (k: string, f: FormData) => String(f.get(k) ?? "");
  return (
    <form className="add-panel career-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); submit({ name: v("name", f), role: v("role", f) || null, company: v("company", f) || null, why: v("why", f) || null, channel: v("channel", f), stage: v("stage", f), email: v("email", f) || null, linkedin_url: v("linkedin_url", f) || null, draft: v("draft", f) || null, next_followup: v("next_followup", f) || null, do_not_contact: f.get("dnc") === "on" }); if (!c) setOpenForm(false); }}>
      <div className="dates-grid">
        <div className="d-field"><label>name</label><input name="name" required maxLength={200} defaultValue={c?.name} /></div>
        <div className="d-field"><label>role</label><input name="role" maxLength={200} defaultValue={c?.role ?? ""} /></div>
        <div className="d-field"><label>company</label><input name="company" maxLength={200} defaultValue={c?.company ?? ""} /></div>
        <div className="d-field"><label>channel</label><select name="channel" defaultValue={c?.channel ?? "linkedin"}><option value="linkedin">linkedin</option><option value="email">email</option></select></div>
        <div className="d-field"><label>stage</label><select name="stage" defaultValue={c?.stage ?? "found"}>{CONTACT_STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="d-field"><label>email</label><input name="email" type="email" maxLength={200} defaultValue={c?.email ?? ""} /></div>
        <div className="d-field"><label>linkedin</label><input name="linkedin_url" type="url" defaultValue={c?.linkedin_url ?? ""} placeholder="https://" /></div>
        <div className="d-field"><label>next follow-up</label><input name="next_followup" type="date" defaultValue={c?.next_followup ?? ""} /></div>
      </div>
      <div className="d-field"><label>why they matter</label><input name="why" maxLength={500} defaultValue={c?.why ?? ""} placeholder="shared school, specialty, a recent move into the role" /></div>
      <div className="d-field"><label>message</label><textarea name="draft" maxLength={5000} defaultValue={c?.draft ?? ""} placeholder="Hi [Name] — I'm a Human Biology co-op student at U of T Scarborough working toward…" /></div>
      <div className="gd-actions">
        <label className="gd-check"><input type="checkbox" name="dnc" defaultChecked={c?.do_not_contact} /> do not contact (the agent never drafts to them)</label>
        <button type="submit" className="btn primary" disabled={busy}>{c ? "save" : "add"}</button>
        <button type="button" className="d-btn" onClick={() => { setOpenForm(false); cancel?.(); }}>cancel</button>
      </div>
    </form>
  );
}
