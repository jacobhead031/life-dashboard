"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import type { DateIdea, DateMedia, DateScore } from "@/lib/types";
import {
  addDateIdea,
  deleteDateIdea,
  deleteDateMedia,
  recordDateMedia,
  reorderDateIdea,
  saveDateIdea,
  saveDateReview,
  seedDateIdeas,
  setDateDone,
  setDateScore,
  type DateIdeaEdit,
} from "@/app/actions";

type Media = DateMedia & { url?: string };
type Patch = Partial<DateIdea> & { id: string };
type View = "todo" | "done" | "food";

const COSTS = ["free", "$", "$$", "$$$"] as const;
const DURATIONS = ["1h", "evening", "half day", "full day"] as const;
const CATEGORIES = ["food", "drinks", "outdoors", "indoors", "walk", "event", "music", "movie", "theatre", "comedy", "sports", "game", "make", "active", "trip", "home", "costume", "scary", "market", "other"];

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function DatesContent({ ideas: serverIdeas, scores, media, userId, todayStr: today }: {
  ideas: DateIdea[]; scores: DateScore[]; media: Media[]; userId: string; todayStr: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [ideas, patch] = useOptimistic(serverIdeas, (list, p: Patch) => list.map((i) => (i.id === p.id ? { ...i, ...p } : i)));
  const [view, setView] = useState<View>("todo");
  const [cost, setCost] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [starred, setStarred] = useState(false);
  const [eaten, setEaten] = useState<"" | "been" | "not">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (openId && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [openId]);

  const update = (p: Patch, write: () => Promise<void>) => startTransition(async () => { patch(p); await write(); });

  const matches = (i: DateIdea) => (!cost || i.cost === cost) && (!duration || i.duration === duration) && (!starred || i.want_more);
  const activities = ideas.filter((i) => i.kind !== "restaurant");
  const restaurants = ideas.filter((i) => i.kind === "restaurant");
  const todo = activities.filter((i) => !i.done_on);
  const done = activities.filter((i) => i.done_on).sort((a, b) => (b.done_on! > a.done_on! ? 1 : -1));
  // ★ means "we really want this": starred rows sit above everything else in both lists.
  const starFirst = (a: DateIdea, b: DateIdea) => Number(b.want_more) - Number(a.want_more);
  const upcoming = todo.filter((i) => i.event_on && matches(i)).sort((a, b) => starFirst(a, b) || a.event_on!.localeCompare(b.event_on!));
  const anytime = todo.filter((i) => !i.event_on && matches(i)).sort((a, b) => starFirst(a, b) || a.position - b.position);
  const avg = (id: string) => {
    const s = scores.filter((x) => x.idea_id === id);
    return s.length ? s.reduce((a, x) => a + x.score, 0) / s.length : null;
  };
  // Been: best to worst. Not yet: starred first, then the drag order. "All" shows both, been first.
  const placeMatches = (i: DateIdea) => (!cost || i.cost === cost) && (!starred || i.want_more);
  const been = restaurants.filter((i) => i.done_on && placeMatches(i)).sort((a, b) => (avg(b.id) ?? 0) - (avg(a.id) ?? 0));
  const notYet = restaurants.filter((i) => !i.done_on && placeMatches(i)).sort((a, b) => starFirst(a, b) || a.position - b.position);
  const food = eaten === "been" ? been : eaten === "not" ? notYet : [...been, ...notYet];
  const open = ideas.find((i) => i.id === openId);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), // press and hold the handle on a phone
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const list = view === "food" ? notYet : anytime;
    const from = list.findIndex((i) => i.id === active.id);
    const to = list.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(list, from, to);
    const prev = moved[to - 1]?.position;
    const next = moved[to + 1]?.position;
    const position = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : 0;
    update({ id: String(active.id), position }, () => reorderDateIdea(String(active.id), position));
  }

  const remove = (i: DateIdea) => {
    if (!confirm(`Delete "${i.title}"? Photos go with it.`)) return;
    // close() fires onClose, which clears openId; clearing openId alone leaves the empty modal up.
    dialog.current?.close();
    startTransition(async () => { await deleteDateIdea(i.id); });
  };
  const toggleDone = (i: DateIdea, on: boolean) => update({ id: i.id, done_on: on ? today : null }, () => setDateDone(i.id, on));
  // Starring also moves it to the top of the list order, so it stays first if it's later unstarred.
  const toggleStar = (i: DateIdea) => {
    const f: DateIdeaEdit = i.want_more ? { want_more: false } : { want_more: true, position: Math.min(0, ...todo.map((t) => t.position)) - 1 };
    update({ id: i.id, ...(f as Partial<DateIdea>) }, () => saveDateIdea(i.id, f));
  };

  if (serverIdeas.length === 0) {
    return (
      <div className="life dates">
        <div className="life-empty">
          <p>Nothing on the list yet.</p>
          <button type="button" className="btn primary" disabled={isPending} onClick={() => startTransition(async () => { await seedDateIdeas(); })}>
            {isPending ? "loading…" : "load the Toronto starter list"}
          </button>
        </div>
      </div>
    );
  }

  const row = (i: DateIdea) => (
    <RowBody key={i.id} idea={i} n={media.filter((m) => m.idea_id === i.id).length} avg={avg(i.id)} disabled={isPending}
      mine={scores.find((x) => x.idea_id === i.id && x.user_id === userId)?.score ?? null}
      score={(v) => startTransition(async () => { await setDateScore(i.id, v); })}
      open={() => setOpenId(i.id)} toggleDone={(on) => toggleDone(i, on)} toggleStar={() => toggleStar(i)} />
  );

  return (
    <div className="life dates">
      <div className="life-head">
        <div>
          <div className="life-kicker">dates · {done.length} done · {todo.length} to go</div>
          <h1 className="life-title">Toronto date bank</h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setAdding((a) => !a)}>{adding ? "close" : "+ idea"}</button>
      </div>

      {adding && <AddForm busy={isPending} initialKind={view === "food" ? "restaurant" : "activity"} submit={(f) => startTransition(async () => { await addDateIdea(f); setAdding(false); })} />}

      <div className="dates-filters">
        <div className="dates-seg" role="tablist">
          {(["todo", "done", "food"] as View[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v === "todo" ? "to do" : v === "done" ? "scrapbook" : "restaurants"}
            </button>
          ))}
        </div>
        {view === "food" && (
          <div className="dates-seg">
            <button type="button" className={eaten === "" ? "on" : ""} onClick={() => setEaten("")}>all</button>
            <button type="button" className={eaten === "been" ? "on" : ""} onClick={() => setEaten("been")}>been</button>
            <button type="button" className={eaten === "not" ? "on" : ""} onClick={() => setEaten("not")}>not yet</button>
          </div>
        )}
        {view !== "done" && (
          <div className="dates-seg">
            <button type="button" className={cost === "" ? "on" : ""} onClick={() => setCost("")}>any cost</button>
            {COSTS.map((c) => <button key={c} type="button" className={cost === c ? "on" : ""} onClick={() => setCost(cost === c ? "" : c)}>{c}</button>)}
          </div>
        )}
        {view === "todo" && (
          <div className="dates-seg">
            <button type="button" className={duration === "" ? "on" : ""} onClick={() => setDuration("")}>any time</button>
            {DURATIONS.map((d) => <button key={d} type="button" className={duration === d ? "on" : ""} onClick={() => setDuration(duration === d ? "" : d)}>{d}</button>)}
          </div>
        )}
        {view !== "done" && (
          <div className="dates-seg">
            <button type="button" className={starred ? "on" : ""} onClick={() => setStarred((s) => !s)}>★ really want</button>
          </div>
        )}
      </div>

      {view === "todo" && (
        <>
          {upcoming.length > 0 && (
            <section>
              <div className="life-cat">coming up</div>
              {upcoming.map((i) => <div key={i.id} className="dates-row"><span className="todo-drag-handle" style={{ visibility: "hidden" }}>⠿</span>{row(i)}</div>)}
            </section>
          )}
          <section>
            <div className="life-cat">anytime</div>
            {anytime.length === 0 && <p className="life-none">Nothing matches. Loosen the filters or add an idea.</p>}
            <DndContext id="dates-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={anytime.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {anytime.map((i) => <SortableRow key={i.id} id={i.id}>{row(i)}</SortableRow>)}
              </SortableContext>
            </DndContext>
          </section>
        </>
      )}

      {view === "done" && (
        <section>
          <div className="life-cat">things we did</div>
          {done.length === 0 && <p className="life-none">Nothing checked off yet. Tick one on the to-do list and it lands here with its album.</p>}
          {done.map((i) => <div key={i.id} className="dates-row"><span className="todo-drag-handle" style={{ visibility: "hidden" }}>⠿</span>{row(i)}</div>)}
        </section>
      )}

      {view === "food" && (
        <section>
          {food.length === 0 && <p className="life-none">No restaurants match. Hit + idea and pick restaurant, or loosen the filters.</p>}
          {eaten !== "not" && been.length > 0 && (
            <>
              <div className="life-cat">been, best to worst</div>
              {been.map((i, n) => <div key={i.id} className="dates-row"><span className="dates-rank">{n + 1}</span>{row(i)}</div>)}
            </>
          )}
          {eaten !== "been" && notYet.length > 0 && (
            <>
              <div className="life-cat">to try</div>
              <DndContext id="places-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={notYet.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {notYet.map((i) => <SortableRow key={i.id} id={i.id}>{row(i)}</SortableRow>)}
                </SortableContext>
              </DndContext>
            </>
          )}
        </section>
      )}

      <dialog ref={dialog} className="life life-dialog" aria-label={open?.title} onClose={() => setOpenId(null)}>
        {open && (
          <IdeaDetail
            key={open.id}
            idea={open}
            media={media.filter((m) => m.idea_id === open.id)}
            scores={scores.filter((s) => s.idea_id === open.id)}
            userId={userId}
            today={today}
            busy={isPending}
            save={(f) => update({ id: open.id, ...(f as Partial<DateIdea>) }, () => saveDateIdea(open.id, f))}
            toggleStar={() => toggleStar(open)}
            toggleDone={(on) => toggleDone(open, on)}
            saveReview={(r) => update({ id: open.id, review: r }, () => saveDateReview(open.id, r))}
            score={(s) => startTransition(async () => { await setDateScore(open.id, s); })}
            removeMedia={(m) => { if (confirm("Delete this from the album?")) startTransition(async () => { await deleteDateMedia(m.id); }); }}
            remove={() => remove(open)}
            close={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </div>
  );
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="dates-row" style={{ opacity: isDragging ? 0.7 : 1, transform: CSS.Transform.toString(transform), transition, ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}) }}>
      <span className="todo-drag-handle" {...attributes} {...listeners}>⠿</span>
      {children}
    </div>
  );
}

function RowBody({ idea: i, n, avg, mine, score, disabled, open, toggleDone, toggleStar }: {
  idea: DateIdea; n: number; avg: number | null; mine: number | null; score: (v: number | null) => void;
  disabled: boolean; open: () => void; toggleDone: (on: boolean) => void; toggleStar: () => void;
}) {
  return (
    <>
      <input type="checkbox" className="todo-check" checked={!!i.done_on} disabled={disabled} onChange={(e) => toggleDone(e.target.checked)} aria-label={`Mark ${i.title} ${i.done_on ? "not done" : "done"}`} title={i.kind === "restaurant" ? "ate here" : "we did this"} />
      <button type="button" className="dates-title" onClick={open}>
        <span>{i.title}</span>
        <span className="dates-chips">
          {i.event_on && <span className="dates-chip when">{longDate(i.event_on)}{i.event_until && i.event_until !== i.event_on ? ` – ${longDate(i.event_until)}` : ""}</span>}
          <span className="dates-chip">{i.cost}</span>
          {i.kind !== "restaurant" && <span className="dates-chip">{i.duration}</span>}
          <span className="dates-chip">{i.category}</span>
          {i.done_on && <span className="dates-chip when">{avg !== null ? `${avg.toFixed(1)}/10` : "unrated"} · {n ? `${n} photos` : "no photos"}</span>}
        </span>
      </button>
      {i.done_on && (
        <select className="dates-date dates-row-score" aria-label={`My score for ${i.title}`} value={mine ?? ""} disabled={disabled} onChange={(e) => score(e.target.value ? Number(e.target.value) : null)}>
          <option value="">me</option>
          {Array.from({ length: 10 }, (_, k) => k + 1).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
      <button type="button" className={`dates-star${i.want_more ? " on" : ""}`} aria-label={i.want_more ? "Want this less" : "Want this more"} disabled={disabled} onClick={toggleStar}>★</button>
    </>
  );
}

function AddForm({ busy, initialKind, submit }: { busy: boolean; initialKind: "activity" | "restaurant"; submit: (f: DateIdeaEdit) => void }) {
  const [kind, setKind] = useState<"activity" | "restaurant">(initialKind);
  const restaurant = kind === "restaurant";
  return (
    <form
      className="add-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit(restaurant ? {
          kind, title: String(f.get("title")), note: String(f.get("note")) || null, url: String(f.get("url")) || null,
          category: String(f.get("cuisine")).trim() || "food", cost: String(f.get("cost")), duration: "evening",
        } : {
          kind, title: String(f.get("title")), note: String(f.get("note")) || null, url: String(f.get("url")) || null,
          category: String(f.get("category")), cost: String(f.get("cost")), duration: String(f.get("duration")),
          event_on: String(f.get("event_on")) || null,
        });
      }}
    >
      <div className="dates-seg">
        <button type="button" className={restaurant ? "" : "on"} onClick={() => setKind("activity")}>activity</button>
        <button type="button" className={restaurant ? "on" : ""} onClick={() => setKind("restaurant")}>restaurant</button>
      </div>
      <div className="d-field"><label htmlFor="di-title">{restaurant ? "restaurant" : "idea"}</label><input id="di-title" name="title" required maxLength={200} placeholder={restaurant ? "Pai, 18 Duncan St" : "Skate at Nathan Phillips"} autoFocus /></div>
      <div className="dates-grid">
        <div className="d-field"><label htmlFor="di-cost">cost</label><select id="di-cost" name="cost" defaultValue="$">{COSTS.map((c) => <option key={c}>{c}</option>)}</select></div>
        {restaurant ? (
          <div className="d-field"><label htmlFor="di-cuisine">cuisine</label><input id="di-cuisine" name="cuisine" maxLength={30} placeholder="thai" /></div>
        ) : (
          <>
            <div className="d-field"><label htmlFor="di-dur">time</label><select id="di-dur" name="duration" defaultValue="evening">{DURATIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="d-field"><label htmlFor="di-cat">type</label><select id="di-cat" name="category" defaultValue="other">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="d-field"><label htmlFor="di-date">date (events only)</label><input id="di-date" name="event_on" type="date" /></div>
          </>
        )}
      </div>
      <div className="d-field"><label htmlFor="di-note">note</label><input id="di-note" name="note" maxLength={2000} placeholder={restaurant ? "neighbourhood, what to order, who recommended it" : "why, where, what to bring"} /></div>
      <div className="d-field"><label htmlFor="di-url">link</label><input id="di-url" name="url" type="url" placeholder="https://" /></div>
      <div className="gd-actions"><button type="submit" className="btn primary" disabled={busy}>add</button></div>
    </form>
  );
}

function IdeaDetail({ idea: i, media, scores, userId, today, busy, save, toggleStar, toggleDone, saveReview, score, removeMedia, remove, close }: {
  idea: DateIdea; media: Media[]; scores: DateScore[]; userId: string; today: string; busy: boolean;
  save: (f: DateIdeaEdit) => void; toggleStar: () => void; toggleDone: (on: boolean) => void; saveReview: (r: string) => void; score: (s: number | null) => void;
  removeMedia: (m: Media) => void; remove: () => void; close: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const restaurant = i.kind === "restaurant";
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const mine = scores.find((s) => s.user_id === userId)?.score ?? null;
  const theirs = scores.find((s) => s.user_id !== userId)?.score ?? null;

  async function upload(files: File[]) {
    if (!files.length || progress) return;
    setErrors([]);
    const failed: string[] = [];
    const supabase = createClient();
    for (const [n, file] of files.entries()) {
      setProgress(`uploading ${n + 1} of ${files.length}…`);
      try {
        const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
        if (!kind) throw new Error("not a photo or video");
        const path = `${i.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        const { error } = await supabase.storage.from("date-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        try {
          await recordDateMedia(i.id, path, kind);
        } catch (err) {
          await supabase.storage.from("date-photos").remove([path]);
          throw err;
        }
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    setErrors(failed);
    setProgress(null);
  }

  return (
    <div className="gd-body">
      <div className="album-head">
        <div>
          <div className="life-kicker">{i.done_on ? `${restaurant ? "ate here" : "done"} ${longDate(i.done_on)}` : i.event_on ? longDate(i.event_on) : restaurant ? "to try" : "idea"} · {i.cost}{restaurant ? "" : ` · ${i.duration}`} · {i.category}</div>
          <h2 className="album-title">{i.title}</h2>
        </div>
        <button type="button" className="gd-close" style={{ position: "static" }} aria-label="Close" onClick={close}>✕</button>
      </div>

      {editing ? (
        <form
          className="dates-edit"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save(restaurant ? {
              title: String(f.get("title")), note: String(f.get("note")) || null, url: String(f.get("url")) || null,
              category: String(f.get("cuisine")).trim() || "food", cost: String(f.get("cost")),
            } : {
              title: String(f.get("title")), note: String(f.get("note")) || null, url: String(f.get("url")) || null,
              category: String(f.get("category")), cost: String(f.get("cost")), duration: String(f.get("duration")),
              event_on: String(f.get("event_on")) || null, event_until: String(f.get("event_until")) || null,
            });
            setEditing(false);
          }}
        >
          <div className="d-field"><label htmlFor="de-title">{restaurant ? "restaurant" : "idea"}</label><input id="de-title" name="title" required maxLength={200} defaultValue={i.title} /></div>
          <div className="dates-grid">
            <div className="d-field"><label htmlFor="de-cost">cost</label><select id="de-cost" name="cost" defaultValue={i.cost}>{COSTS.map((c) => <option key={c}>{c}</option>)}</select></div>
            {restaurant ? (
              <div className="d-field"><label htmlFor="de-cuisine">cuisine</label><input id="de-cuisine" name="cuisine" maxLength={30} defaultValue={i.category} /></div>
            ) : (<>
            <div className="d-field"><label htmlFor="de-dur">time</label><select id="de-dur" name="duration" defaultValue={i.duration}>{DURATIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="d-field"><label htmlFor="de-cat">type</label><select id="de-cat" name="category" defaultValue={CATEGORIES.includes(i.category) ? i.category : "other"}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="d-field"><label htmlFor="de-on">from</label><input id="de-on" name="event_on" type="date" defaultValue={i.event_on ?? ""} /></div>
            <div className="d-field"><label htmlFor="de-until">until</label><input id="de-until" name="event_until" type="date" defaultValue={i.event_until ?? ""} /></div>
            </>)}
          </div>
          <div className="d-field"><label htmlFor="de-note">note</label><textarea id="de-note" name="note" maxLength={2000} defaultValue={i.note ?? ""} /></div>
          <div className="d-field"><label htmlFor="de-url">link</label><input id="de-url" name="url" type="url" defaultValue={i.url ?? ""} /></div>
          <div className="gd-actions">
            <button type="submit" className="btn primary" disabled={busy}>save</button>
            <button type="button" className="d-btn" onClick={() => setEditing(false)}>cancel</button>
          </div>
        </form>
      ) : (
        <>
          {i.note && <p className="dates-note">{i.note}</p>}
          {i.url && <a className="dates-link" href={i.url} target="_blank" rel="noreferrer">{i.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]} ↗</a>}
          <div className="gd-actions">
            <label className="gd-check"><input type="checkbox" checked={!!i.done_on} disabled={busy} onChange={(e) => toggleDone(e.target.checked)} /> {restaurant ? "ate here" : "we did this"}</label>
            {i.done_on && (
              <label className="gd-check">on <input type="date" className="dates-date" value={i.done_on} max={today} disabled={busy} aria-label="Date we did it" onChange={(e) => { if (e.target.value) save({ done_on: e.target.value }); }} /></label>
            )}
            <label className="gd-check"><input type="checkbox" checked={i.want_more} disabled={busy} onChange={toggleStar} /> ★ really want to do this</label>
            <button type="button" className="d-btn" onClick={() => setEditing(true)}>edit</button>
            <button type="button" className="d-btn danger" disabled={busy} onClick={remove}>delete</button>
          </div>
        </>
      )}

      {i.done_on && (
        <>
          <div className="dates-scores">
            <div className="life-kicker">scores</div>
            <div className="dates-score-row">
              <span>me</span>
              <select aria-label="My score" value={mine ?? ""} disabled={busy} onChange={(e) => score(e.target.value ? Number(e.target.value) : null)}>
                <option value="">–</option>
                {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>them</span>
              <span className="dates-score">{theirs ?? "–"}</span>
            </div>
          </div>

          <div className="gd-actions">
            <button type="button" className="btn primary" disabled={!!progress} onClick={() => fileInput.current?.click()}>{progress ?? (restaurant ? "add photos of the food" : "add photos & videos")}</button>
            <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          </div>
          {errors.map((msg) => <p key={msg} className="gd-error" role="alert">{msg}</p>)}
          {media.length > 0 && (
            <div className="album-grid">
              {media.map((m) => (
                <figure key={m.id} className={m.kind === "video" ? "wide" : ""}>
                  {m.kind === "video" ? (
                    <video src={m.url} controls playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL
                    <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>
                  )}
                  <button type="button" className="gd-close" aria-label="Delete from album" onClick={() => removeMedia(m)}>✕</button>
                </figure>
              ))}
            </div>
          )}

          <div className="album-notes">
            <div className="life-kicker">review</div>
            <textarea defaultValue={i.review ?? ""} placeholder={restaurant ? "What we ordered, what was good, would we go back?" : "How was it? Would we go back?"} aria-label="Review" maxLength={20000}
              onBlur={(e) => { if (e.target.value !== (i.review ?? "")) saveReview(e.target.value); }} />
          </div>
        </>
      )}
    </div>
  );
}
