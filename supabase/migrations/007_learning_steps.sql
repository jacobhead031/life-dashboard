-- Learning tracks: real steps instead of a bare counter, plus a course link and notes.
-- steps is [{ id, title, done }] in display order. total_steps / completed_steps /
-- current_label stay as derived values (written together with steps) for the home card.
alter table learning_track add column if not exists steps jsonb not null default '[]';
alter table learning_track add column if not exists url   text;
alter table learning_track add column if not exists notes text;

-- One-time backfill from the old counter. Guarded: only touches tracks with no steps yet.
update learning_track t set steps = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid(),
    'title', case when n = t.completed_steps + 1 then t.current_label else '' end,
    'done', n <= t.completed_steps
  ) order by n), '[]'::jsonb)
  from generate_series(1, t.total_steps) n
)
where t.steps = '[]'::jsonb and t.total_steps > 0;

-- A link that had been parked in the step label moves to the new url column.
update learning_track t set
  url = current_label,
  current_label = '',
  steps = (
    select jsonb_agg(case when s->>'title' = t.current_label then jsonb_set(s, '{title}', '""') else s end order by ord)
    from jsonb_array_elements(t.steps) with ordinality as e(s, ord)
  )
where url is null and current_label ~* '^https?://';

-- A label on a finished track belongs to no step; keep it in notes rather than lose it.
update learning_track set notes = current_label
where notes is null and current_label <> '' and completed_steps >= total_steps;
