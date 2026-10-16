@AGENTS.md

# Notes / Second Brain — Schema Reference

## Tables

### `projects`
```sql
id uuid, user_id uuid, title text, area area, status project_status,
next_action text, why text, repo_url text, live_url text,
created_at timestamptz, updated_at timestamptz, touched_at timestamptz
```
- `area` enum: `career | personal`
- `status` enum: `active | seed | done`

### `notes`
```sql
id uuid, user_id uuid, project_id uuid (nullable), body text,
source text, done boolean (default false),
position double precision (default 0, lower = higher in the to-do list), created_at timestamptz
```
- `source` values: `manual | quick-capture | claude-code`
- `done` — notes on a project page render as a to-do list; checked = done

### `project_files`
```sql
id uuid, user_id uuid, project_id uuid, name text, path text,
size bigint, created_at timestamptz
```
- `path` is the object name in the **private** `project-files` storage bucket: `<user_id>/<project_id>/<ts>-<filename>`. Storage policy requires the first segment to be the caller's uid; the UI links via signed URLs, never `/object/public/`.
- Deleting a project cascades to `project_files` rows; `deleteProject` removes the storage objects first. Its notes fall back to the inbox (`on delete set null`).


### `learning_track`
```sql
id uuid, user_id uuid, name text, steps jsonb (default '[]'), total_steps int, completed_steps int,
current_label text, accent text ('amber' | 'sky'), url text, notes text, updated_at timestamptz
```
- `steps` is `[{ id, title, done }]` in display order and is the source of truth. `total_steps`, `completed_steps` and `current_label` (title of the first unchecked step) are derived and rewritten with it by `saveTrackSteps` — never write them on their own.
- `url` must be http(s); it renders as the course link on `/learning` and on the home card.

### `school_class`
```sql
id uuid, user_id uuid, name text, days int[] (ISO weekday 1=Mon..7=Sun),
start_time time (nullable), color text (#RRGGBB, Google Calendar palette), created_at timestamptz
```
- `color` tints every chip of that class (`--chip` on `.cal-chip`) on `/school` and the home week card.

### `user_settings`
```sql
user_id uuid (pk), home_order text[] (default '{}')
```
- `home_order` is the home dashboard card order (ids from the `slots` list in `app/page.tsx`). Empty = default order; ids it doesn't mention keep their default place after it (`applyOrder` in `components/HomeGrid.tsx`). A new home card only needs a new slot entry.

### `school_item`
```sql
id uuid, user_id uuid, class_id uuid (fk school_class, cascade), title text,
kind text ('assignment' | 'exam'), due_on date, done boolean (default false),
position double precision (default 0, lower = higher in the weekly to-do), created_at timestamptz
```
- `/school` weekly to-do lists items due in [today, today+7] plus unchecked overdue, ordered by `position`. Its checkbox and the calendar chip write the same `done` flag. Terminal inserts default to `position = 0` (top of the list).
- Home page banner + week card read `school_item` where `due_on` in [Monday of this week, today+7].
- The 7:30 health-coach email (`~/health-coach/school_brief.py`) reads both tables via PostgREST with the service key.

### `life_goal` (+ `life_counter_entry`, `life_move_log`, `journal_log`)
```sql
life_goal: id uuid, user_id uuid, slug text (unique per user), title text, emoji text,
  category text (Adventure|Body|Build|Skills|People|Mind),
  type text (experience|ladder|count|countdown|habit), active boolean, status text (someday|active|done),
  why text, first_move text, next_move text, target_date date, steps jsonb ([{label, done, doneDate?}]),
  count_current int, season_target int, lifetime_target int, requires text[] (slugs),
  image_query text, cover_url text, cover_credit text, photo_path text, completed_on date,
  notes text, position double precision, created_at timestamptz
life_counter_entry: id, user_id, counter text (countries|continents|wonders|concerts), name text, happened_on date, notes text (recipe / review, edited in the entry's album)
life_move_log: id, user_id, goal_id uuid (fk life_goal, cascade), move text, done_on date
journal_log: user_id, date (pk on both);  user_settings.journal_start date
```
- The life list lives at **`/life`** (tab label "Goals"). `/goals` is still Monthly goals.
- `active` (shows on the home "this year" card) and `status` are independent; the home card shows `active` goals whose status isn't `done`.
- "Today's move" is the `next_move` of one active goal, rotated by date (`moveGoalForDay` in `lib/life.ts`). Done writes a `life_move_log` row and clears `next_move`.
- **Countries** count distinct countries, not rows: `countryKey` in `lib/countries.ts` folds repeat trips and spellings ("USA" = "United States"). Its counter opens the map (`app/life/CountriesMap.tsx`, d3-geo on canvas, lazy-loaded); an entry lights up when its name matches a map country.
- Other counter totals are row counts; targets and the season window are constants in `lib/life.ts`. `count_current` is one number shown against both targets, so rolling the season over does not reset it.
- Every goal has an album too (`life_media.goal_id`; exactly one of `entry_id` / `goal_id` is set). `photo_path` is the cover and must be the path of an image in that goal's album: the first photo uploaded sets it, "make cover" changes it, and deleting the cover image hands it to the next one. A card with its own photo is shown unblurred even before it's done.
- Cover precedence: `photo_path` (private `goal-photos` bucket, `<user_id>/<goal_id>/<ts>-<filename>`, signed per render) > `cover_url` > the category gradient in CSS. `fillCovers` fills `cover_url` from Unsplash when `UNSPLASH_ACCESS_KEY` is set.
- Seed: `lib/life-goals.json` via `seedLifeGoals` (skips slugs that already exist).
- **Albums:** a `life_counter_entry` belongs to a counter (`counter` set) or to a count goal (`goal_id` set, e.g. a song), never both. `life_media` (`entry_id`, `path`, `kind` image|video) holds its photos and videos in the `goal-photos` bucket at `<user_id>/<entry_id>/<ts>-<filename>`. Adding a goal entry bumps `count_current`; deleting one drops it. `deleteCounterEntry` removes the album's storage objects first (storage doesn't cascade).

### `tri_*` — triathlon coach (`/coach`)
```sql
tri_profile: user_id (pk), race_date, goal_s/floor_s/stretch_s int (seconds), ftp_watts, css_s_100m,
  thr_run_s_km, lthr, max_hr, weight_kg, hockey_days int[] (ISO 1=Mon..7=Sun), pool_slots jsonb, updated_at
tri_phase: id, user_id, name, start_on, end_on, focus, hours_min, hours_max
tri_session: id, user_id, date, slot (am|pm), sport (swim|bike|run|brick|strength|hockey|mobility|test|race|rest),
  title, purpose, duration_min, structure text (Intervals.icu workout text), is_key, location,
  status (planned|adjusted|done|partial|skipped|moved), adjusted_reason, intervals_event_id,
  created_by (season|weekly|daily|user), created_at, updated_at
tri_activity: id, user_id, intervals_activity_id (unique per user), session_id (fk, set null), date, sport,
  duration_s, distance_m, avg_hr, avg_watts, np_watts, pace_s_km, load, raw jsonb
tri_checkin: id, user_id, session_id, date, kind (post_session|post_hockey|weekly|adhoc), channel (email|tab|voice),
  rpe 1-10, legs, sleep, mood, pain bool, pain_where, notes, raw_text
tri_gear: id, user_id, rank, item, area, buy_by date, status (have|shopping|need|ordered), why
tri_message: id, user_id, role (athlete|coach), channel, content, session_id
health_day (+): target_carbs_g, target_protein_g, ctl, atl
```
- Design: `docs/superpowers/specs/2026-10-15-tri-coach-design.md`. The Python agents in `~/health-coach` (`tri_*.py`) write with the service key and an explicit `user_id`; the tab reads/writes via RLS.
- **Intervals.icu is the training hub.** Planned sessions are pushed as events with `external_id = tri_session.id` (bulk upsert, idempotent); completed activities come back from Intervals (Garmin/Zwift truth), never from WHOOP. `health_day` doubles as whoop_daily + nutrition_daily: `push_health.py` must never send calorie columns or `null`s, because calories are typed in the tab.
- Tests and races are `tri_session` rows (`sport = test|race`); pool slots live on the profile. Seed: `~/health-coach/tri_season.py seed`.
- **`/coach` tab** (`app/coach/`): Today (Done/Skipped/Move + calories), week strip, season, check-in with push-to-talk (Web Speech API, no key), gear. Skipped deletes the Intervals event and Move re-dates it (`lib/intervals.ts`, needs `INTERVALS_API_KEY` + `INTERVALS_ATHLETE_ID` in Vercel; without them the tab is DB-only and says so). A move sets `adjusted_reason = "moved from …"`, which the Sunday rebuild respects. PWA: `app/manifest.ts` starts on `/coach`; `proxy.ts` lets `manifest.webmanifest` through.

## Key rules

- **`project_id IS NULL` on a note = inbox.** Unfiled is a state, not a place.
- **`touched_at` ≠ `updated_at`.** `touched_at` moves ONLY when: a note is attached to the project. Editing title/why/links must NOT move `touched_at`. This prevents stale projects masquerading as active.
- **`next_action` is retired from the UI.** The column still exists but nothing reads or writes it anymore. "What's next" everywhere (project page, home card, projects list) is the **lowest-`position` unchecked to-do** (`notes` where `done = false`, `order by position asc`).
- **Active projects order by `touched_at ASC`** on the home card — surface the stalest live project so nothing gets forgotten.
- **Dates:** every "today" goes through `todayStr()` in `lib/utils.ts` (America/Toronto). Never `new Date().toISOString()` — the server is UTC, so that is tomorrow from 8pm.
- **Server actions throw on failure** (`ok()` / `authed()` in `app/actions.ts`); call them inside `startTransition(async …)` so errors reach `app/error.tsx`.
- **Migrations:** `supabase/migrations/` replays from scratch (`000` is the baseline for tables first created by hand). Apply new ones per the memory note, not via the Supabase MCP.

## Status meanings

| Status | Meaning |
|--------|---------|
| `active` | Working on it now |
| `seed` | An idea, unbuilt |
| `done` | Finished |

## Terminal inserts

When adding notes from the terminal, use `source = 'claude-code'` (`projects` has no `source` column).

Example — add a seed:
```sql
insert into projects (user_id, title, area, status)
select id, 'your idea here', 'career', 'seed'
from auth.users where email = 'jacobhead031@gmail.com';
```

Example — add a quick note to inbox:
```sql
insert into notes (user_id, body, source)
select id, 'your thought here', 'claude-code'
from auth.users where email = 'jacobhead031@gmail.com';
```

Query stalest active project:
```sql
select title, touched_at
from projects
where status = 'active'
order by touched_at asc
limit 1;
```
