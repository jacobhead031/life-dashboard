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
- `status` enum: `active | warm | cold | seed`

### `notes`
```sql
id uuid, user_id uuid, project_id uuid (nullable), body text,
source text, done boolean (default false), created_at timestamptz
```
- `source` values: `manual | quick-capture | claude-code`
- `done` — notes on a project page render as a to-do list; checked = done

### `project_files`
```sql
id uuid, user_id uuid, project_id uuid, name text, path text,
size bigint, created_at timestamptz
```

## Key rules

- **`project_id IS NULL` on a note = inbox.** Unfiled is a state, not a place.
- **`touched_at` ≠ `updated_at`.** `touched_at` moves ONLY when: (1) a note is attached to the project, or (2) `next_action` changes. Editing title/why/links must NOT move `touched_at`. This prevents stale projects masquerading as active.
- **Active/warm projects order by `touched_at ASC`** on the home card — surface the stalest live project so nothing gets forgotten.
- **`cold` projects** are hidden from the main `/notes` view. Reachable via filter only.

## Status meanings

| Status | Meaning |
|--------|---------|
| `active` | Working on it now |
| `warm` | Paused, could resume this month |
| `cold` | Real work, shelved, not dead |
| `seed` | An idea, unbuilt |

## Terminal inserts

When adding data from the terminal, use `source = 'claude-code'`.

Example — add a seed:
```sql
insert into projects (user_id, title, area, status, source)
select id, 'your idea here', 'career', 'seed', 'claude-code'
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
select title, next_action, touched_at
from projects
where status in ('active','warm')
order by touched_at asc
limit 1;
```
