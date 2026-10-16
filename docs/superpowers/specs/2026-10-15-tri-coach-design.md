# Apex → Triathlon Coach: design

Extends `~/health-coach` (Python, launchd, `claude -p`) and this dashboard (Next 16 on Vercel, Supabase) into a 70.3 coach for IRONMAN 70.3 Maine, 2027-07-25, goal sub-5:45. Source spec: Jacob's `apex-tri-coach-build-spec.md` (Oct 15 2026). Go-live target Nov 2 2026.

## Decisions

- **Hybrid LLM.** Scheduled agents stay Python + `claude -p` on the Mac. Only the Coach tab chat uses the Anthropic API from Vercel (`ANTHROPIC_API_KEY`).
- **Voice is browser-native.** Web Speech API for speech-to-text, `speechSynthesis` for the reply. No paid providers.
- **Intervals.icu is the training hub.** Completed activities, pairing to planned workouts, and the fitness trend (CTL/ATL) come from Intervals. WHOOP stays recovery/sleep only, already in `health_day`. Planned workouts are pushed to Intervals with `external_id = tri_session.id` and bulk upsert, so re-pushing is idempotent.
- **Email cap by construction.** Tri adds at most one new email a day. Daily Coach replaces the run-coach section inside the existing 07:00 email. Fuel targets ride inside the existing 20:00 calorie prompt. The weekly plan, review and gear line share one Sunday 18:00 email. "How'd that feel?" is the only standalone new email, at most once a day.
- **No new scheduler cadence the Mac can't keep.** The Mac sleeps; launchd replays missed fires once at wake. Intervals polling runs inside the jobs that already fire (sync 09:00/13:00, a new 17:00 entry, daily 20:00). "1–2 h after a key session" becomes "the next poll".
- **Rules in Python, prose in the model.** The Weekly Builder lays out the week deterministically (template, hockey days, pool slots, 3:1 cycle, ≤10% ramp against actual load). `claude -p` only writes title, purpose and interval structure per slot, returning JSON. A parse failure falls back to template text, never to an empty week.
- **Season Planner is a script, not an agent.** Phases are date arithmetic from the race date. `tri_season.py seed` writes profile, phases and the test checkpoints once; `tri_season.py retest` updates zones from a test result. Goal-time changes are proposed in the Sunday email, never applied silently.
- **Done / Skipped / Move go straight to Intervals** from the server action (plain `fetch`, basic auth, `INTERVALS_API_KEY` on Vercel), then update `tri_session`. No outbox.
- **Shadow mode** = `INTERVALS_PUSH=0` in `~/health-coach/.env` (payloads logged, nothing sent to Garmin) plus a `[shadow]` subject prefix on tri emails. Same inbox; single user.
- **Python 3.9.** No `match`, no `X | Y` annotations.

## Data model (migration `014_tri.sql`)

All tables: `user_id uuid not null references auth.users on delete cascade`, RLS "users manage own <t>", `check (… in (…))` not enums, `set_updated_at` trigger where there is an `updated_at`.

| Table | Purpose | Key columns |
|---|---|---|
| `tri_profile` | one row per user | pk `user_id`; `race_date`, `goal_s`, `floor_s`, `stretch_s`, `ftp_watts`, `css_s_100m`, `thr_run_s_km`, `lthr`, `max_hr`, `weight_kg`, `hockey_days int[]` (ISO 1–7), `pool_slots jsonb` (`[{pool, weekday, start, end, valid_from, valid_to}]`), `updated_at` |
| `tri_phase` | season phases | `name`, `start_on`, `end_on`, `focus`, `hours_min`, `hours_max` |
| `tri_session` | planned sessions; tests and races are sessions too | `date`, `slot` (`am`/`pm`), `sport` (`swim bike run brick strength hockey mobility test race rest`), `title`, `purpose`, `duration_min`, `structure text` (Intervals workout text), `is_key`, `location`, `status` (`planned adjusted done partial skipped moved`), `adjusted_reason`, `intervals_event_id`, `created_by` (`season weekly daily user`), `updated_at` |
| `tri_activity` | completed activities from Intervals | `intervals_activity_id` unique, `session_id` fk nullable, `date`, `sport`, `duration_s`, `distance_m`, `avg_hr`, `avg_watts`, `np_watts`, `pace_s_km`, `load`, `raw jsonb` |
| `tri_checkin` | post-session, post-hockey, weekly, ad hoc | `session_id` fk nullable, `date`, `kind`, `channel` (`email tab voice`), `rpe int`, `legs`, `sleep`, `mood`, `pain bool`, `pain_where`, `notes`, `raw_text` |
| `tri_gear` | equipment list | `rank`, `item`, `area`, `buy_by`, `status` (`have shopping need ordered`), `why` |
| `tri_message` | coach chat, text and voice transcripts | `role` (`athlete coach`), `channel`, `content`, `session_id` fk nullable |
| `health_day` (+cols) | whoop_daily + nutrition_daily | add `target_carbs_g`, `target_protein_g`, `ctl`, `atl`. `push_health.upsert` only sends its own keys with `merge-duplicates`, so these survive the nightly sync. |

Dropped from the spec: `milestones` (test/race rows in `tri_session`), `pool_schedule` (jsonb on the profile), `whoop_daily`, `nutrition_daily`, `completed_sessions` as a WHOOP mirror.

Seeds (`tri_season.py seed`): profile (race 2027-07-25, goal 5:45:00, floor 6:00, stretch 5:30, hockey `{2,7}`, TPASC slots from the spec), phases (Recover Oct 19–Nov 1, Base Nov 2–Feb 28, Build Mar 1–May 30, Race-specific May 31–Jul 10, Taper Jul 11–24, Race Jul 25), test sessions (Nov 7 FTP ramp + CSS, Feb 27 retest, Jun 20 tune-up, Dec 20 180 km Zwift), the 26-row equipment list.

## Python modules (`~/health-coach`)

| File | Role |
|---|---|
| `tri_db.py` | `get` (re-export of `school_brief._get`), `upsert` (re-export of `push_health.upsert`), new `patch(table, filters, body)`. |
| `intervals_client.py` | `push_events(rows)` (bulk upsert on `external_id`), `update_event`, `delete_event`, `activities(oldest, newest)`, `wellness(oldest, newest)`. Honours `INTERVALS_PUSH=0`. `--selftest` with a mocked `requests`. |
| `daily_brief.py` | `claude_bin()` + subprocess extracted into `run_claude(prompt, stdin) -> str`. Three callers justify it. |
| `tri_persona.md` | the shared persona from spec §11, prepended to every `claude -p` prompt. |
| `tri_season.py` | `seed`, `retest`, `--dry-run`. |
| `tri_weekly.py` | skeleton → `run_claude` content → validate → upsert `tri_session` → `push_events` → Sunday 18:00 email (plan, last week's review, gear line, one question). `--dry-run`, `--selftest` for skeleton rules. |
| `tri_daily.py` | `section(today) -> (subject, lines, foot)`. Green/yellow/red thresholds as module constants; yellow/red patches the session (`status='adjusted'`, `adjusted_reason`) and the Intervals event. |
| `tri_checkin.py` | `poll()`: activities since yesterday → `tri_activity`, mark paired session done, wellness → `health_day.ctl/atl`; key sessions done with no check-in and no email today → send "How'd that feel? YYYY-MM-DD". `handle_reply(day, body)`: first 1–10 integer is RPE, "pain"/"hurt" sets `pain`, rest is `raw_text`. |
| `tri_fuel.py` | `targets(tomorrow)`: g/kg from tomorrow's planned duration and sport (spec §9) and `health_day.weight`; upserts `health_day.target_*`; returns two lines for the 20:00 prompt. |

Hooks into existing code:
- `run_coach.py run_brief` (lines 496–503): when `week_for()` is None, use `tri_daily.section(today)` instead of the "School today" stub. Tri counts as content for the early return at line 499.
- `coach_email.py _log_replies`: one more tuple (`"How'd that feel?"`, date regex, done-dates from `tri_checkin`, `tri_checkin.handle_reply`). `replies` and `daily` commands call `tri_checkin.poll()` first. `send_daily_prompt(extra_lines=())` takes the fuel lines.
- `install.sh`: `make_plist tri-weekly` Sunday 18:00; add 17:00 to `day_syncs`. `watchdog.py CHECKS` gains `tri-weekly.log` / `"Sent: "`.

Guardrails live in `tri_weekly.validate()`: swims only in pool slots, no hard run the morning after hockey, no heavy legs within 24 h of a key run or long ride, long ride +10–15 min/week, run volume ≤ +10%/week, every 4th week and exam weeks (Dec, Apr) 60–70% volume, week total ≤ last week +10% unless the last weekly check-in said "good".

## Coach tab (`/coach`)

- `components/TabNav.tsx`: add `"coach"` and a Coach link. Seven tabs scroll on a phone (`.tab-nav` already `overflow-x: auto`).
- `app/coach/page.tsx`: server component in the `/school` shape. Fetches profile, phases, this week's sessions (Mon–Sun via `weekMonday(todayStr())`), today's `health_day`, last 28 `health_day` for ctl/atl, test sessions, gear, last 50 messages.
- `app/coach/CoachContent.tsx` (`"use client"`), panels top to bottom, each a `.card` in `.grid-bento`:
  1. **Today**: session(s) with sport, duration, structure, purpose; recovery colour from `recoveryColor` (reuse from `HealthContent`) and `adjusted_reason`; fuel targets; buttons Done / Skipped / Move (date input).
  2. **This week**: 7-column strip in `.school-week`; chip colour green done, amber partial/adjusted, coral skipped, muted planned; hours by sport.
  3. **Season**: days to race (`daysBetween`), current phase, goal time, test results, CTL/ATL sparkline (reuse `Sparkline`).
  4. **Check-in**: RPE 1–10, legs, sleep, mood, pain + where, notes, mic button.
  5. **Gear**: table with editable status.
  6. **Coach chat**: thread from `tri_message`, text box, mic, speak-replies toggle.
- `app/actions.ts` additions: `setSessionStatus(id, status, newDate?)` (Intervals first, then DB), `addCheckin`, `saveGearStatus`, `sendCoachMessage(text, channel)` (Anthropic API, persona + profile + this week + last 7 check-ins + 7 days of `health_day`; tools `move_session` and `shorten_session` that call `setSessionStatus`/`patch` so conversation mode can change the week; saves both turns to `tri_message`).
- `lib/intervals.ts`: the one `fetch` wrapper for the Intervals API, used by the actions.
- `lib/speech.ts` + hook in `CoachContent`: `webkitSpeechRecognition` push-to-talk and `speechSynthesis` reply, shared by the check-in mic and the chat.
- `app/manifest.ts` (`display: standalone`, `start_url: /coach`), icons in `public/`, and `proxy.ts` matcher excludes `manifest.webmanifest` and the icons.
- Env on Vercel: `ANTHROPIC_API_KEY`, `INTERVALS_API_KEY`, `INTERVALS_ATHLETE_ID`. New dependency: `@anthropic-ai/sdk`.
- Errors: actions throw into `app/error.tsx` as elsewhere. Chat errors render inline (`.gd-error`) so the thread survives.

## Build order

| # | Step | Done when |
|---|---|---|
| 1 | Intervals.icu account, connect Garmin/Zwift/WHOOP, tick "Upload planned workouts", API key + athlete id in `.env` | A ride pushed via `intervals_client.py` shows on the Forerunner 265 and in Zwift custom workouts |
| 2 | `014_tri.sql` + `tri_season.py seed`; `lib/types.ts` rows; CLAUDE.md schema section | Migration applied, seed inserts profile, 6 phases, tests, 26 gear rows; existing Health/School pages unchanged |
| 3 | `tri_db.py`, `intervals_client.py`, `run_claude` | `intervals_client.py --selftest` passes; tomorrow's 07:00 email unchanged |
| 4 | `tri_daily.py` + `run_brief` hook (half-marathon plan retires Oct 19) | `run_coach.py brief --dry-run` shows today's session with the recovery read |
| 5 | `tri_weekly.py` + `tri_persona.md` + plist | Sunday dry run prints a valid week; live run puts events in Intervals, on the watch and in Zwift |
| 6 | `tri_checkin.py` + reply handler + 17:00 sync | Reply "7, legs heavy" lands in `tri_checkin` by the next sync; a key session gets its email |
| 7 | Coach tab panels 1–5, PWA | Skipped removes the Garmin workout; Move changes its date; installable on the phone |
| 8 | Chat + voice | "What's today?" answers from real data; push-to-talk fills the check-in on iOS Safari; "move Thursday's run to Friday" moves it |
| 9 | `tri_fuel.py` + gear line | 20:00 email carries tomorrow's targets; Sunday email lists gear due within 30 days |
| 10 | Shadow week with `INTERVALS_PUSH=0` and `[shadow]` subjects | Jacob approves; flip both and go live Nov 2 |

Deferred: streaming chat, offline service worker, home-page card, Garmin pace targets (Intervals doesn't export them yet), a second shadow inbox.
