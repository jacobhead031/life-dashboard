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


### `school_class`
```sql
id uuid, user_id uuid, name text, days int[] (ISO weekday 1=Mon..7=Sun),
start_time time (nullable), created_at timestamptz
```

### `school_item`
```sql
id uuid, user_id uuid, class_id uuid (fk school_class, cascade), title text,
kind text ('assignment' | 'exam'), due_on date, done boolean (default false),
position double precision (default 0, lower = higher in the weekly to-do), created_at timestamptz
```
- `/school` weekly to-do lists items due in [today, today+7] plus unchecked overdue, ordered by `position`. Its checkbox and the calendar chip write the same `done` flag. Terminal inserts default to `position = 0` (top of the list).
- Home page banner + week card read `school_item` where `due_on` in [Monday of this week, today+7].
- The 7:30 health-coach email (`~/health-coach/school_brief.py`) reads both tables via PostgREST with the service key.

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
