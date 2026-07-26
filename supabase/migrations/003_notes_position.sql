-- Manual to-do ordering. Already applied to the remote project on 2026-07-26
-- via MCP apply_migration; archived here for the record.
alter table notes add column if not exists position double precision not null default 0;

-- One-time backfill: seed position from the old created_at-desc display order.
-- Guarded so a re-run cannot clobber manual orderings (only touches rows still
-- at the untouched default in projects that have never been reordered).
update notes set position = sub.rn
from (
  select id, row_number() over (partition by project_id order by created_at desc) - 1 as rn
  from notes
) sub
where notes.id = sub.id
  and not exists (select 1 from notes n2 where n2.project_id is not distinct from notes.project_id and n2.position <> 0);
