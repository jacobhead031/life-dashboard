"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { addTriCheckin, saveTriCalories, setTriGearStatus, setTriSessionStatus } from "@/app/actions";
import type { HealthDay, TriCheckin, TriGear, TriPhase, TriProfile, TriSession, TriSessionStatus } from "@/lib/types";
import { addDays, daysBetween, weekMonday } from "@/lib/utils";
import { recoveryColor, Sparkline } from "@/app/health/HealthContent";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_COLOR: Record<TriSessionStatus, string> = {
  planned: "var(--muted-2)", adjusted: "var(--amber)", done: "var(--green)",
  partial: "var(--amber)", skipped: "var(--coral)", moved: "var(--muted-2)",
};
const SPORT_ICON: Record<string, string> = {
  swim: "🏊", bike: "🚴", run: "🏃", brick: "🚴🏃", strength: "🏋️", hockey: "🏒", mobility: "🧘", test: "⏱", race: "🏁", rest: "😴",
};
const GEAR_STATUSES = ["need", "shopping", "ordered", "have"] as const;
// Goal splits from the build spec (sub-5:45); re-evaluated at each test checkpoint.
const GOAL_SPLITS = [
  { leg: "swim 1.9 km", time: "0:35", needs: "~2:15 /100 m + current" },
  { leg: "T1 + T2", time: "0:10", needs: "practised, spread-out venue" },
  { leg: "bike 90 km", time: "2:58", needs: "~30 km/h at 70-78% FTP" },
  { leg: "run 21.1 km", time: "2:02", needs: "~5:47 /km off the bike" },
];

function hms(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Push-to-talk into a textarea. Web Speech API only (Chrome, iOS Safari); no key, no server.
function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<{ stop: () => void } | null>(null);
  const supported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-CA"; r.interimResults = false; r.continuous = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " ";
      if (t) onText(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }
  return { supported, listening, toggle };
}
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void;
};

function SessionCard({ s, today, onStatus, busy }: { s: TriSession; today: string; onStatus: (id: string, st: TriSessionStatus, date?: string) => void; busy: boolean }) {
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState(addDays(s.date, 1));
  const terminal = s.status === "done" || s.status === "skipped";
  return (
    <div className="coach-session" style={{ "--chip": STATUS_COLOR[s.status] } as React.CSSProperties}>
      <div className="coach-session-head">
        <span className="coach-sport">{SPORT_ICON[s.sport] ?? "•"}</span>
        <strong>{s.title}</strong>
        <span className="coach-meta">{s.sport}{s.duration_min ? ` · ${s.duration_min} min` : ""}{s.location ? ` · ${s.location}` : ""}</span>
        <span className="coach-status">{s.status}{s.date !== today ? ` · ${fmtDay(s.date)}` : ""}</span>
      </div>
      {s.purpose && <p className="coach-why">{s.purpose}</p>}
      {s.structure && <pre className="coach-steps">{s.structure}</pre>}
      {s.adjusted_reason && <p className="coach-adjust">⚠️ {s.adjusted_reason}</p>}
      {s.sport !== "hockey" && s.sport !== "rest" && (
        <div className="coach-actions">
          {!terminal && <button className="d-btn success" disabled={busy} onClick={() => onStatus(s.id, "done")}>Done</button>}
          {!terminal && <button className="d-btn danger" disabled={busy} onClick={() => onStatus(s.id, "skipped")}>Skipped</button>}
          {terminal && <button className="d-btn" disabled={busy} onClick={() => onStatus(s.id, "planned")}>Undo</button>}
          {!terminal && !moving && <button className="d-btn" disabled={busy} onClick={() => setMoving(true)}>Move</button>}
          {moving && (
            <>
              <input type="date" value={to} min={today} onChange={(e) => setTo(e.target.value)} aria-label="New date" />
              <button className="d-btn" disabled={busy} onClick={() => { setMoving(false); onStatus(s.id, "moved", to); }}>Move it</button>
              <button className="d-btn" onClick={() => setMoving(false)}>Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function CoachContent({ today, profile, phases, week, tests, health, checkins, gear, syncOn }: {
  today: string; profile: TriProfile | null; phases: TriPhase[]; week: TriSession[]; tests: TriSession[];
  health: HealthDay[]; checkins: TriCheckin[]; gear: TriGear[]; syncOn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [sessions, patchSession] = useOptimistic(week, (state, p: Partial<TriSession> & { id: string }) =>
    state.map((s) => (s.id === p.id ? { ...s, ...p } : s)));
  const [picked, setPicked] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week; the page loads 2 back and 6 ahead
  const thisMonday = weekMonday(today);
  const monday = addDays(thisMonday, 7 * weekOffset);
  const weekSessions = sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6));
  const isDraft = weekOffset > 1; // only next week is written in full and on the watch
  const todays = sessions.filter((s) => s.date === today);
  const pickedSession = sessions.find((s) => s.id === picked) ?? null;
  const todayHealth = health.find((h) => h.date === today) ?? null;
  const phase = phases.find((p) => p.start_on <= today && p.end_on >= today) ?? null;
  const daysToRace = profile ? daysBetween(today, profile.race_date) : null;
  const trend = health.filter((h) => h.ctl != null).map((h) => ({ date: h.date, value: h.ctl as number }));
  const fatigue = health.filter((h) => h.atl != null).map((h) => ({ date: h.date, value: h.atl as number }));

  function status(id: string, st: TriSessionStatus, date?: string) {
    startTransition(async () => {
      patchSession({ id, status: st === "moved" ? "planned" : st, ...(date ? { date } : {}) });
      await setTriSessionStatus(id, st, date);
    });
  }

  // ── check-in form ──
  const [rpe, setRpe] = useState<number | null>(null);
  const [pain, setPain] = useState(false);
  const [crowd, setCrowd] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const swamToday = todays.some((s) => s.sport === "swim");
  const dictation = useDictation((t) => setNotes((n) => (n ? `${n} ${t}` : t)));
  const [calDate, setCalDate] = useState(today);
  const calRow = health.find((h) => h.date === calDate) ?? null;

  const hoursBySport = weekSessions.filter((s) => s.sport !== "hockey").reduce<Record<string, number>>((acc, s) => {
    if (s.status === "done" || s.status === "partial") acc[s.sport] = (acc[s.sport] ?? 0) + (s.duration_min ?? 0);
    return acc;
  }, {});
  const plannedMin = weekSessions.filter((s) => s.sport !== "hockey").reduce((a, s) => a + (s.duration_min ?? 0), 0);
  const doneMin = Object.values(hoursBySport).reduce((a, b) => a + b, 0);

  return (
    <div className="grid-bento coach">
      {!syncOn && <p className="coach-notice">Watch sync is off: set INTERVALS_API_KEY and INTERVALS_ATHLETE_ID in Vercel. Buttons still update the dashboard.</p>}

      <section className="card span-4">
        <div className="card-label"><span>today · {fmtDay(today)}</span>{isPending && <span className="card-nav">saving…</span>}</div>
        {todayHealth?.recovery_pct != null && (
          <p className="coach-recovery" style={{ "--chip": recoveryColor(todayHealth.recovery_pct) } as React.CSSProperties}>
            Recovery {Math.round(todayHealth.recovery_pct)}%
            {todayHealth.sleep_hours != null && ` · slept ${todayHealth.sleep_hours.toFixed(1)} h`}
            {todayHealth.hrv != null && ` · HRV ${Math.round(todayHealth.hrv)}`}
          </p>
        )}
        {todays.length === 0 && <div className="empty-state"><p>Nothing planned today{phase ? ` · ${phase.name}` : ""}.</p></div>}
        {todays.map((s) => <SessionCard key={s.id} s={s} today={today} onStatus={status} busy={isPending} />)}
        {(todayHealth?.target_carbs_g || todayHealth?.target_protein_g) && (
          <p className="coach-fuel">Fuel today: {todayHealth.target_carbs_g ?? "—"} g carbs · {todayHealth.target_protein_g ?? "—"} g protein</p>
        )}
      </section>

      <section className="card span-2">
        <div className="card-label"><span>calories</span></div>
        <form
          className="coach-cal"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const n = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
            const data = { date: calDate, calories: n("calories"), protein: n("protein"), carbs: n("carbs"), fat: n("fat") };
            form.reset();
            startTransition(() => saveTriCalories(data));
          }}
        >
          <select value={calDate} onChange={(e) => setCalDate(e.target.value)} aria-label="Day">
            <option value={today}>today</option>
            <option value={addDays(today, -1)}>yesterday</option>
            <option value={addDays(today, -2)}>{fmtDay(addDays(today, -2))}</option>
          </select>
          <input name="calories" type="number" inputMode="numeric" placeholder="kcal" />
          <div className="coach-macros">
            <input name="protein" type="number" inputMode="numeric" placeholder="P g" />
            <input name="carbs" type="number" inputMode="numeric" placeholder="C g" />
            <input name="fat" type="number" inputMode="numeric" placeholder="F g" />
          </div>
          <button className="btn primary" disabled={isPending}>Save</button>
          <p className="coach-meta">
            {calRow?.calories != null
              ? `Logged: ${calRow.calories} kcal${calRow.protein != null ? ` · P ${calRow.protein}` : ""}${calRow.carbs != null ? ` · C ${calRow.carbs}` : ""}${calRow.fat != null ? ` · F ${calRow.fat}` : ""}`
              : "Nothing logged for this day yet."}
          </p>
        </form>
      </section>

      <section className="card span-6">
        <div className="card-label">
          <span>
            {weekOffset === 0 ? "this week" : weekOffset === 1 ? "next week" : `${fmtDay(monday)} week`}
            {isDraft ? " · draft" : ` · ${Math.round(doneMin / 6) / 10} of ${Math.round(plannedMin / 6) / 10} h`}
          </span>
          <span className="coach-weeknav">
            <button className="d-btn" onClick={() => { setWeekOffset(weekOffset - 1); setPicked(null); }} disabled={weekOffset <= -2} aria-label="Previous week">‹</button>
            <button className="d-btn" onClick={() => { setWeekOffset(0); setPicked(null); }} disabled={weekOffset === 0}>today</button>
            <button className="d-btn" onClick={() => { setWeekOffset(weekOffset + 1); setPicked(null); }} disabled={weekOffset >= 6} aria-label="Next week">›</button>
          </span>
        </div>
        {isDraft && weekSessions.length > 0 && <p className="coach-meta" style={{ margin: "0 0 8px" }}>Rough shape only: which days you swim, run, bike and lift. The exact sessions are written the Sunday before.</p>}
        {weekSessions.length === 0 && <div className="empty-state"><p>Nothing planned this week yet.</p></div>}
        <div className="school-week">
          {DOW.map((d, i) => {
            const date = addDays(monday, i);
            return (
              <div key={d}>
                <div className={`school-day${date === today ? " today" : ""}`}>{d} {Number(date.slice(8))}</div>
                {weekSessions.filter((s) => s.date === date).map((s) => (
                  <button
                    key={s.id}
                    className={`cal-chip coach-chip${picked === s.id ? " on" : ""}`}
                    style={{ "--chip": STATUS_COLOR[s.status] } as React.CSSProperties}
                    onClick={() => setPicked(picked === s.id ? null : s.id)}
                  >
                    {SPORT_ICON[s.sport] ?? "•"} {s.title}
                    <span className="cal-meta">{s.duration_min ? `${s.duration_min}m` : ""}{s.status !== "planned" ? ` · ${s.status}` : ""}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {pickedSession && <SessionCard s={pickedSession} today={today} onStatus={status} busy={isPending} />}
      </section>

      <section className="card span-6">
        <div className="card-label"><span>season</span>{phase && <span className="card-nav">{phase.name}</span>}</div>
        {profile ? (
          <div className="coach-season">
            <div>
              <div className="stat-num">{daysToRace}</div>
              <div className="stat-sub">days to Maine · {fmtDay(profile.race_date)}</div>
              <p className="coach-goal">
                <strong>Goal {hms(profile.goal_s)}</strong>
                {profile.floor_s && <span className="coach-meta"> · floor {hms(profile.floor_s)}</span>}
                {profile.stretch_s && <span className="coach-meta"> · stretch {hms(profile.stretch_s)}</span>}
              </p>
              <div className="coach-splits">
                {GOAL_SPLITS.map((g) => (
                  <div key={g.leg}><dt>{g.leg}</dt><dd>{g.time}</dd><span className="coach-meta">{g.needs}</span></div>
                ))}
              </div>
              {phase && <p className="coach-phase"><strong>{phase.name}</strong> · {fmtDay(phase.start_on)} to {fmtDay(phase.end_on)}<br /><span className="coach-meta">{phase.focus}</span></p>}
              <dl className="coach-zones">
                <div><dt>FTP</dt><dd>{profile.ftp_watts ? `${profile.ftp_watts} W` : "test Nov 7"}</dd></div>
                <div><dt>CSS</dt><dd>{profile.css_s_100m ? `${Math.floor(profile.css_s_100m / 60)}:${String(profile.css_s_100m % 60).padStart(2, "0")} /100 m` : "test Nov 6"}</dd></div>
                <div><dt>Run threshold</dt><dd>{profile.thr_run_s_km ? `${Math.floor(profile.thr_run_s_km / 60)}:${String(profile.thr_run_s_km % 60).padStart(2, "0")} /km` : "from the half"}</dd></div>
              </dl>
            </div>
            <table className="coach-tests">
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className={t.date < today ? "past" : ""} style={{ "--chip": STATUS_COLOR[t.status] } as React.CSSProperties}>
                    <td className="coach-meta">{fmtDay(t.date)}</td>
                    <td>{SPORT_ICON[t.sport]} {t.title}</td>
                    <td className="coach-status">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>No profile yet. Run <code>tri_season.py seed</code>.</p></div>
        )}
      </section>

      <section className="card span-3">
        <div className="card-label"><span>fitness · fatigue (Intervals.icu)</span></div>
        {trend.length >= 2 ? (
          <>
            <Sparkline points={trend} color="var(--sky)" format={(v) => `CTL ${v.toFixed(0)}`} />
            {fatigue.length >= 2 && <Sparkline points={fatigue} color="var(--coral)" format={(v) => `ATL ${v.toFixed(0)}`} height={48} />}
          </>
        ) : (
          <div className="empty-state"><p>Fills in once workouts flow back from Intervals.icu.</p></div>
        )}
      </section>

      <section className="card span-3">
        <div className="card-label"><span>check-in</span></div>
        <form
          className="coach-checkin"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const v = (k: string) => (f.get(k) ? String(f.get(k)) : null);
            const data = {
              date: today, session_id: todays.find((s) => s.is_key)?.id ?? todays[0]?.id ?? null, rpe,
              legs: v("legs"), sleep: v("sleep"), mood: v("mood"), pain, pain_where: pain ? v("pain_where") : null,
              notes: notes || null, channel: "tab" as const, crowd: swamToday ? crowd : null,
            };
            startTransition(async () => { await addTriCheckin(data); setRpe(null); setPain(false); setCrowd(null); setNotes(""); });
          }}
        >
          <div className="rpe-row" role="radiogroup" aria-label="Effort 1 to 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} className={`class-pill${rpe === n ? " on" : ""}`} aria-pressed={rpe === n} onClick={() => setRpe(n)}>{n}</button>
            ))}
          </div>
          <div className="d-form-row">
            <div className="d-field"><label>legs</label><select name="legs" defaultValue=""><option value="">—</option><option>fresh</option><option>ok</option><option>heavy</option><option>dead</option><option>sore</option></select></div>
            <div className="d-field"><label>sleep</label><select name="sleep" defaultValue=""><option value="">—</option><option>good</option><option>ok</option><option>bad</option></select></div>
            <div className="d-field"><label>mood</label><select name="mood" defaultValue=""><option value="">—</option><option>good</option><option>flat</option><option>stressed</option><option>great</option></select></div>
          </div>
          {swamToday && (
            <div className="rpe-row" role="radiogroup" aria-label="How crowded was the pool, 1 to 5">
              <span className="coach-meta" style={{ alignSelf: "center" }}>pool crowd</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} className={`class-pill${crowd === n ? " on" : ""}`} style={{ "--chip": "var(--amber)" } as React.CSSProperties} aria-pressed={crowd === n} onClick={() => setCrowd(n)}>{n}</button>
              ))}
            </div>
          )}
          <label className="coach-pain"><input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} /> pain</label>
          {pain && <input name="pain_where" placeholder="where, and what kind" />}
          <div className="coach-notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="one line" rows={2} />
            {dictation.supported && (
              <button type="button" className={`d-btn${dictation.listening ? " danger" : ""}`} onClick={dictation.toggle} aria-pressed={dictation.listening}>
                {dictation.listening ? "■ stop" : "🎤"}
              </button>
            )}
          </div>
          <button className="btn primary" disabled={isPending || (rpe == null && !notes)}>Log check-in</button>
        </form>
        {checkins.length > 0 && (
          <ul className="rec-list coach-recent">
            {checkins.map((c) => (
              <li key={c.id}><span className="coach-meta">{fmtDay(c.date)}</span> {c.rpe != null ? `RPE ${c.rpe}` : ""}{c.legs ? ` · legs ${c.legs}` : ""}{c.crowd != null ? ` · crowd ${c.crowd}/5` : ""}{c.pain ? " · ⚠️ pain" : ""}{c.notes || c.raw_text ? ` · ${c.notes ?? c.raw_text}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card span-6">
        <div className="card-label"><span>gear</span><span className="card-nav">{gear.filter((g) => g.status === "have").length}/{gear.length}</span></div>
        <table className="coach-gear">
          <tbody>
            {[...gear].sort((a, b) => Number(a.status === "have") - Number(b.status === "have") || (a.rank ?? 99) - (b.rank ?? 99)).map((g) => (
              <tr key={g.id} className={g.status === "have" ? "have" : ""}>
                <td className="coach-meta">{g.rank ?? ""}</td>
                <td>{g.item}{g.buy_by && <span className="cal-meta"> · by {new Date(`${g.buy_by}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span>}</td>
                <td>
                  <select value={g.status} aria-label={`${g.item} status`} onChange={(e) => startTransition(() => setTriGearStatus(g.id, e.target.value as TriGear["status"]))}>
                    {GEAR_STATUSES.map((st) => <option key={st}>{st}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
