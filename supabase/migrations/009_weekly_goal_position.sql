-- Manual ordering for weekly goals on the home card (lower = higher).
alter table weekly_goal add column if not exists position double precision not null default 0;

-- One-time backfill from the old created_at order. Guarded: only weeks nobody has reordered.
update weekly_goal g set position = sub.rn
from (select id, row_number() over (partition by user_id, week order by created_at) as rn from weekly_goal) sub
where g.id = sub.id
  and not exists (select 1 from weekly_goal g2 where g2.user_id = g.user_id and g2.week = g.week and g2.position <> 0);
