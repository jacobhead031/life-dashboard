"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LifeCounterEntry, LifeGoal, LifeMedia, LifeStep } from "@/lib/types";
import { LIFE_CATEGORIES, LIFE_COUNTERS } from "@/lib/life";
import {
  addCounterEntry,
  addGoalEntry,
  addLifeGoal,
  deleteCounterEntry,
  deleteLifeMedia,
  recordLifeMedia,
  fillCovers,
  saveLifeGoal,
  saveLifeGoalSteps,
  seedLifeGoals,
  setLifeCount,
  setLifeGoalDone,
  setLifeGoalPhoto,
} from "@/app/actions";

type Goal = LifeGoal & { photo_url?: string };
type Media = LifeMedia & { url?: string };
type Patch = Partial<Goal> & { id: string };
type Filter = "all" | "active" | "someday" | "done";

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// My photo wins, then the stock cover; with neither, CSS paints the category gradient.
function coverStyle(g: Goal): React.CSSProperties | undefined {
  const img = g.photo_url ?? g.cover_url;
  return img ? { backgroundImage: `url(${JSON.stringify(img)})` } : undefined;
}

export function LifeContent({
  goals: serverGoals,
  entries,
  media,
  canFetchCovers,
  todayStr: today,
}: {
  goals: Goal[];
  entries: LifeCounterEntry[];
  media: Media[];
  canFetchCovers: boolean;
  todayStr: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [goals, patch] = useOptimistic(serverGoals, (list, p: Patch) => list.map((g) => (g.id === p.id ? { ...g, ...p } : g)));
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openCounter, setOpenCounter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const albumDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (openId && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [openId]);
  // Opened after the goal dialog, so an album launched from a goal sits on top of it.
  useEffect(() => {
    if (albumId && albumDialog.current && !albumDialog.current.open) albumDialog.current.showModal();
  }, [albumId]);

  const album = entries.find((e) => e.id === albumId);
  const removeEntry = (e: LifeCounterEntry) => {
    const n = media.filter((m) => m.entry_id === e.id).length;
    if (confirm(n ? `Remove "${e.name}" and the ${n} photo${n === 1 ? "" : "s"}/video${n === 1 ? "" : "s"} in it? This can't be undone.` : `Remove "${e.name}"?`)) {
      startTransition(async () => { await deleteCounterEntry(e.id); });
    }
  };

  const open = goals.find((g) => g.id === openId);
  const shown = goals.filter((g) => filter === "all" || g.status === filter);
  const people = goals.filter((g) => g.category === "People");
  const lockedBy = (g: Goal) => g.requires.flatMap((slug) => goals.filter((x) => x.slug === slug && x.status !== "done"));

  // Optimistic patch + server write in one transition, so a failure reaches app/error.tsx.
  function update(p: Patch, write: () => Promise<void>) {
    startTransition(async () => {
      patch(p);
      await write();
    });
  }

  if (serverGoals.length === 0) {
    return (
      <div className="life life-empty">
        <h1 className="life-title">The life list</h1>
        <p>Thirty-six things worth a lifetime, waiting to be hung on the wall.</p>
        <button type="button" className="btn primary" disabled={isPending} onClick={() => startTransition(async () => { await seedLifeGoals(); })}>
          {isPending ? "hanging the frames…" : "Start my life list"}
        </button>
      </div>
    );
  }

  const counter = LIFE_COUNTERS.find((c) => c.key === openCounter);
  const missingCovers = goals.some((g) => !g.cover_url && !g.photo_path && g.image_query);

  return (
    <div className="life">
      <h1 className="life-title">The life list</h1>

      {/* ── Counters ── */}
      <div className="life-counters">
        {LIFE_COUNTERS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`life-counter${openCounter === c.key ? " open" : ""}`}
            aria-expanded={openCounter === c.key}
            onClick={() => setOpenCounter(openCounter === c.key ? null : c.key)}
          >
            <span className="life-counter-num">
              {entries.filter((e) => e.counter === c.key).length}<small>/{c.target}</small>
            </span>
            <span className="life-kicker">{c.label}</span>
          </button>
        ))}
      </div>
      {counter && (
        <div className="add-panel">
          <div className="add-panel-title">{counter.label}</div>
          {entries.filter((e) => e.counter === counter.key).map((e) => (
            <EntryRow key={e.id} entry={e} media={media} disabled={isPending} open={() => setAlbumId(e.id)} remove={() => removeEntry(e)} />
          ))}
          <form
            className="d-form-row"
            style={{ marginTop: 12, marginBottom: 0, alignItems: "flex-end" }}
            onSubmit={(ev) => {
              ev.preventDefault();
              const form = ev.currentTarget;
              const f = new FormData(form);
              const name = String(f.get("name") ?? "").trim();
              if (!name) return;
              startTransition(async () => {
                await addCounterEntry(counter.key, name, String(f.get("date") ?? "") || null);
                form.reset();
              });
            }}
          >
            <div className="d-field" style={{ flex: 2 }}>
              <label htmlFor="entry-name">name</label>
              <input id="entry-name" name="name" maxLength={200} required placeholder={counter.key === "concerts" ? "Who did you see?" : "Where?"} />
            </div>
            <div className="d-field">
              <label htmlFor="entry-date">date</label>
              <input id="entry-date" name="date" type="date" />
            </div>
            <button type="submit" className="btn primary" disabled={isPending}>add</button>
          </form>
        </div>
      )}

      {/* ── People: pinned above the wall so they never sink ── */}
      {people.length > 0 && (
        <>
          <h2 className="life-cat">The people</h2>
          <div className="life-people">
            {people.map((g) => (
              <div key={g.id} className="life-person">
                <button type="button" className="life-person-title" onClick={() => setOpenId(g.id)}>
                  <span aria-hidden>{g.emoji}</span> {g.title}
                </button>
                <textarea
                  key={g.notes ?? ""}
                  defaultValue={g.notes ?? ""}
                  placeholder="Where would they go?"
                  aria-label={`${g.title}: where would they go?`}
                  maxLength={5000}
                  rows={2}
                  onBlur={(e) => {
                    const notes = e.target.value;
                    if (notes !== (g.notes ?? "")) update({ id: g.id, notes }, () => saveLifeGoal(g.id, { notes }));
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── The wall ── */}
      <div className="detail-top-row" style={{ marginTop: 36 }}>
        <div className="d-tabs">
          {(["all", "active", "someday", "done"] as Filter[]).map((f) => (
            <button key={f} type="button" className={`d-tab${filter === f ? " active" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
              <span style={{ opacity: 0.45, marginLeft: 4 }}>({f === "all" ? goals.length : goals.filter((g) => g.status === f).length})</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canFetchCovers && missingCovers && (
            <button type="button" className="d-btn" disabled={isPending} onClick={() => startTransition(async () => { await fillCovers(); })}>
              {isPending ? "fetching…" : "fetch covers"}
            </button>
          )}
          <button type="button" className="d-btn" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "✕ cancel" : "+ add goal"}</button>
        </div>
      </div>

      {showAdd && (
        <form
          className="add-panel d-form-row"
          style={{ alignItems: "flex-end" }}
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            const title = String(f.get("title") ?? "").trim();
            if (!title) return;
            setShowAdd(false);
            startTransition(async () => { await addLifeGoal(title, String(f.get("category"))); });
          }}
        >
          <div className="d-field" style={{ flex: 2 }}>
            <label htmlFor="new-goal-title">new goal</label>
            <input id="new-goal-title" name="title" maxLength={200} required autoFocus />
          </div>
          <div className="d-field">
            <label htmlFor="new-goal-cat">category</label>
            <select id="new-goal-cat" name="category">{LIFE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <button type="submit" className="btn primary">add</button>
        </form>
      )}

      {shown.length === 0 && <p className="life-none">Nothing here yet.</p>}
      {LIFE_CATEGORIES.map((cat) => {
        const list = shown.filter((g) => g.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h2 className="life-cat">{cat}</h2>
            <div className="life-wall">
              {list.map((g) => {
                const locked = lockedBy(g);
                const move = g.next_move ?? g.first_move;
                return (
                  <button key={g.id} type="button" className={`goal-card${g.status === "done" ? " done" : ""}`} data-cat={g.category} onClick={() => setOpenId(g.id)}>
                    <span className="g-cover" style={coverStyle(g)} />
                    <span className="g-body">
                      <span className="g-emoji" aria-hidden>{g.emoji}</span>
                      <span className="g-title">{g.title}</span>
                      {g.status === "done" ? (
                        <span className="g-caption">{g.completed_on ? longDate(g.completed_on) : "done"}</span>
                      ) : (
                        <>
                          {locked.length > 0 && <span className="g-lock">unlocks after: {locked.map((x) => x.title).join(", ")}</span>}
                          {move && <span className="g-move">{move}</span>}
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <dialog
        ref={dialog}
        className="life life-dialog"
        aria-label={open?.title}
        onClose={() => setOpenId(null)}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        {open && (
          <GoalDetail
            key={open.id}
            goal={open}
            locked={lockedBy(open)}
            today={today}
            update={update}
            close={() => dialog.current?.close()}
            entries={entries.filter((e) => e.goal_id === open.id)}
            media={media}
            busy={isPending}
            openAlbum={setAlbumId}
            removeEntry={removeEntry}
            addEntry={(name, date) => startTransition(async () => { await addGoalEntry(open.id, name, date); })}
          />
        )}
      </dialog>

      <dialog
        ref={albumDialog}
        className="life life-dialog"
        aria-label={album?.name}
        onClose={() => setAlbumId(null)}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        {album && (
          <Album
            key={album.id}
            entry={album}
            media={media.filter((m) => m.entry_id === album.id)}
            close={() => albumDialog.current?.close()}
            remove={(m) => { if (confirm("Delete this from the album? This can't be undone.")) startTransition(async () => { await deleteLifeMedia(m.id); }); }}
          />
        )}
      </dialog>
    </div>
  );
}

// One line in a counter or a goal's list. The name opens its album.
function EntryRow({ entry: e, media, disabled, open, remove }: { entry: LifeCounterEntry; media: Media[]; disabled: boolean; open: () => void; remove: () => void }) {
  const n = media.filter((m) => m.entry_id === e.id).length;
  return (
    <div className="life-entry">
      <button type="button" className="life-entry-name" onClick={open}>
        {e.name} <span className="life-entry-date">{n ? `${n} in album →` : "add photos & video →"}</span>
      </button>
      <span className="life-entry-date">{e.happened_on ? longDate(e.happened_on) : ""}</span>
      <button type="button" className="d-btn danger" aria-label={`Remove ${e.name}`} disabled={disabled} onClick={remove}>✕</button>
    </div>
  );
}

// Photos and videos for one entry: a trip, a concert, a song played all the way through.
function Album({ entry, media, close, remove }: { entry: LifeCounterEntry; media: Media[]; close: () => void; remove: (m: Media) => void }) {
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setErrors([]);
    const failed: string[] = [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    for (const [i, file] of files.entries()) {
      setProgress(`uploading ${i + 1} of ${files.length}…`);
      try {
        if (!user) throw new Error("not signed in");
        const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
        if (!kind) throw new Error("not a photo or video");
        // Storage keys reject spaces and accents; phone filenames are full of them.
        const path = `${user.id}/${entry.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        const { error } = await supabase.storage.from("goal-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        try {
          await recordLifeMedia(entry.id, path, kind);
        } catch (err) {
          // No row means nothing would ever list or delete the object.
          await supabase.storage.from("goal-photos").remove([path]);
          throw err;
        }
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    setErrors(failed);
    setProgress(null);
    e.target.value = "";
  }

  return (
    <div className="gd">
      <div className="gd-body">
        <div className="album-head">
          <div>
            <div className="life-kicker">{entry.happened_on ? longDate(entry.happened_on) : "album"}</div>
            <h2 className="album-title">{entry.name}</h2>
          </div>
          <button type="button" className="gd-close" style={{ position: "static" }} aria-label="Close" onClick={close}>✕</button>
        </div>
        <div className="gd-actions">
          <button type="button" className="btn primary" disabled={!!progress} onClick={() => fileInput.current?.click()}>
            {progress ?? "add photos & videos"}
          </button>
          <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} />
        </div>
        {errors.map((msg) => <p key={msg} className="gd-error" role="alert">{msg}</p>)}
        {media.length === 0 ? (
          <p className="life-none" style={{ marginTop: 0 }}>Nothing here yet. Add the photos and videos that prove it happened.</p>
        ) : (
          <div className="album-grid">
            {media.map((m) => (
              <figure key={m.id} className={m.kind === "video" ? "wide" : ""}>
                {m.kind === "video" ? (
                  <video src={m.url} controls playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL; next/image would need remotePatterns and re-optimise private files
                  <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" /></a>
                )}
                <button type="button" className="gd-close" aria-label="Delete from album" onClick={() => remove(m)}>✕</button>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalDetail({
  goal: g,
  locked,
  today,
  update,
  close,
  entries,
  media,
  busy,
  openAlbum,
  removeEntry,
  addEntry,
}: {
  goal: Goal;
  locked: Goal[];
  today: string;
  update: (p: Patch, write: () => Promise<void>) => void;
  close: () => void;
  entries: LifeCounterEntry[]; // this goal's named items (songs, dishes)
  media: Media[];
  busy: boolean;
  openAlbum: (entryId: string) => void;
  removeEntry: (e: LifeCounterEntry) => void;
  addEntry: (name: string, date: string | null) => void;
}) {
  const [newStep, setNewStep] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const done = g.status === "done";
  const hasSteps = g.steps.length > 0 || g.type === "ladder" || g.type === "countdown";

  const saveSteps = (steps: LifeStep[]) => update({ id: g.id, steps }, () => saveLifeGoalSteps(g.id, steps));
  const setCount = (n: number) => update({ id: g.id, count_current: n }, () => setLifeCount(g.id, n));

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const int = (k: string) => (text(k).trim() === "" ? null : Number(text(k)));
    const title = text("title").trim();
    if (!title) return;
    const fields = {
      title,
      emoji: text("emoji").trim(),
      category: text("category") as Goal["category"],
      active: f.get("active") === "on",
      why: text("why"),
      first_move: text("first_move"),
      next_move: text("next_move"),
      target_date: text("target_date") || null,
      notes: text("notes"),
      ...(g.type === "count" ? { season_target: int("season_target"), lifetime_target: int("lifetime_target") } : {}),
    };
    // Only send the cover when it changed: saving it clears the photographer credit.
    const cover = text("cover_url").trim() || null;
    const write = cover === g.cover_url ? fields : { ...fields, cover_url: cover };
    update({ id: g.id, ...write }, () => saveLifeGoal(g.id, write));
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const path = `${user.id}/${g.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("goal-photos").upload(path, file);
      if (error) throw error;
      try {
        await setLifeGoalPhoto(g.id, path);
      } catch (err) {
        // No row pointing at it means nothing would ever show or delete the object.
        await supabase.storage.from("goal-photos").remove([path]);
        throw err;
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div className="gd">
      <div className={`gd-hero goal-card${done ? " done" : ""}`} data-cat={g.category}>
        <span className="g-cover" style={coverStyle(g)} />
        <span className="g-body">
          <span className="g-emoji" aria-hidden>{g.emoji}</span>
          <span className="g-title">{g.title}</span>
          {done && <span className="g-caption">{g.completed_on ? longDate(g.completed_on) : "done"}</span>}
          {!done && locked.length > 0 && <span className="g-lock">unlocks after: {locked.map((x) => x.title).join(", ")}</span>}
        </span>
        <button type="button" className="gd-close" aria-label="Close" onClick={close}>✕</button>
      </div>

      <div className="gd-body">
        <div className="gd-actions">
          {done ? (
            <>
              <button type="button" className="btn primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? "uploading…" : g.photo_path ? "replace my photo" : "add my photo"}
              </button>
              {g.photo_path && (
                <button type="button" className="d-btn danger" onClick={() => { if (confirm("Remove your photo?")) update({ id: g.id, photo_path: null, photo_url: undefined }, () => setLifeGoalPhoto(g.id, null)); }}>
                  remove photo
                </button>
              )}
              <button type="button" className="d-btn" onClick={() => update({ id: g.id, status: g.active ? "active" : "someday", completed_on: null }, () => setLifeGoalDone(g.id, false))}>
                undo done
              </button>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={handlePhoto} />
            </>
          ) : (
            <button type="button" className="btn primary" onClick={() => update({ id: g.id, status: "done", completed_on: today }, () => setLifeGoalDone(g.id, true))}>
              mark done
            </button>
          )}
        </div>
        {uploadError && <p className="gd-error" role="alert">Photo upload failed: {uploadError}</p>}

        {g.type === "count" && (
          <div className="gd-count">
            <button type="button" className="d-btn" aria-label="One fewer" disabled={g.count_current <= 0} onClick={() => setCount(g.count_current - 1)}>−</button>
            <span className="ty-big">{g.count_current}</span>
            <button type="button" className="d-btn" aria-label="One more" onClick={() => setCount(g.count_current + 1)}>+</button>
            <span className="ty-sub">
              {g.season_target != null && <>{g.count_current} / {g.season_target} this season</>}
              {g.season_target != null && g.lifetime_target != null && " · "}
              {g.lifetime_target != null && <>{g.count_current} / {g.lifetime_target} lifetime</>}
            </span>
          </div>
        )}

        {g.type === "count" && (
          <div className="gd-steps">
            <div className="life-kicker">the list · open one to add the proof</div>
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} media={media} disabled={busy} open={() => openAlbum(e.id)} remove={() => removeEntry(e)} />
            ))}
            <form
              className="quick-add-row"
              onSubmit={(ev) => {
                ev.preventDefault();
                const form = ev.currentTarget;
                const name = String(new FormData(form).get("name") ?? "").trim();
                if (!name) return;
                addEntry(name, today);
                form.reset();
              }}
            >
              <input className="quick-add-input" name="name" placeholder="Add one by name (counts as +1)…" aria-label="Add a named item" maxLength={200} required />
              <button type="submit" className="d-btn" disabled={busy}>add</button>
            </form>
          </div>
        )}

        {hasSteps && (
          <div className="gd-steps">
            <div className="life-kicker">the ladder</div>
            {g.steps.map((s, i) => (
              <div key={i} className="gd-step">
                <label>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => saveSteps(g.steps.map((x, j) => (j === i ? (x.done ? { label: x.label, done: false } : { ...x, done: true, doneDate: today }) : x)))}
                  />
                  <span className={s.done ? "struck" : ""}>{s.label}</span>
                </label>
                {s.done && s.doneDate && <span className="life-entry-date">{longDate(s.doneDate)}</span>}
                <button type="button" className="d-btn danger" aria-label={`Remove step: ${s.label}`} onClick={() => { if (confirm(`Remove "${s.label}"?`)) saveSteps(g.steps.filter((_, j) => j !== i)); }}>✕</button>
              </div>
            ))}
            <form
              className="quick-add-row"
              onSubmit={(e) => {
                e.preventDefault();
                const label = newStep.trim();
                if (!label) return;
                setNewStep("");
                saveSteps([...g.steps, { label, done: false }]);
              }}
            >
              <input className="quick-add-input" value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step…" aria-label="Add a step" maxLength={200} />
              <button type="submit" className="d-btn" disabled={!newStep.trim()}>add</button>
            </form>
          </div>
        )}

        <form onSubmit={save}>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: "0 0 64px", minWidth: 64 }}>
              <label htmlFor="gd-emoji">icon</label>
              <input id="gd-emoji" name="emoji" defaultValue={g.emoji} maxLength={16} />
            </div>
            <div className="d-field" style={{ flex: 3 }}>
              <label htmlFor="gd-title">title</label>
              <input id="gd-title" name="title" defaultValue={g.title} maxLength={200} required />
            </div>
          </div>
          <div className="d-field" style={{ marginBottom: 12 }}>
            <label htmlFor="gd-why">why it matters</label>
            <textarea id="gd-why" name="why" defaultValue={g.why ?? ""} maxLength={2000} />
          </div>
          <div className="d-form-row">
            <div className="d-field">
              <label htmlFor="gd-first">first move</label>
              <input id="gd-first" name="first_move" defaultValue={g.first_move ?? ""} maxLength={500} />
            </div>
            <div className="d-field">
              <label htmlFor="gd-next">next move</label>
              <input id="gd-next" name="next_move" defaultValue={g.next_move ?? ""} maxLength={500} />
            </div>
          </div>
          <div className="d-form-row">
            <div className="d-field">
              <label htmlFor="gd-cat">category</label>
              <select id="gd-cat" name="category" defaultValue={g.category}>{LIFE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="d-field">
              <label htmlFor="gd-date">target date</label>
              <input id="gd-date" name="target_date" type="date" defaultValue={g.target_date ?? ""} />
            </div>
          </div>
          {g.type === "count" && (
            <div className="d-form-row">
              <div className="d-field">
                <label htmlFor="gd-season">season target</label>
                <input id="gd-season" name="season_target" type="number" min={0} defaultValue={g.season_target ?? ""} />
              </div>
              <div className="d-field">
                <label htmlFor="gd-life">lifetime target</label>
                <input id="gd-life" name="lifetime_target" type="number" min={0} defaultValue={g.lifetime_target ?? ""} />
              </div>
            </div>
          )}
          <div className="d-field" style={{ marginBottom: 12 }}>
            <label htmlFor="gd-notes">{g.category === "People" ? "where would they go?" : "notes"}</label>
            <textarea id="gd-notes" name="notes" defaultValue={g.notes ?? ""} maxLength={5000} />
          </div>
          <div className="d-field" style={{ marginBottom: 12 }}>
            <label htmlFor="gd-cover">cover image url{g.cover_credit ? ` · photo: ${g.cover_credit}` : ""}</label>
            <input id="gd-cover" name="cover_url" type="url" defaultValue={g.cover_url ?? ""} placeholder="https://…" maxLength={2000} />
          </div>
          <div className="d-form-actions">
            <button type="submit" className="btn primary">save</button>
            <label className="gd-check">
              <input type="checkbox" name="active" defaultChecked={g.active} /> show on the home page
            </label>
          </div>
        </form>
      </div>
    </div>
  );
}
