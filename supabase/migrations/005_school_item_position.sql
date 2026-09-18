-- Manual ordering for the School tab's weekly to-do list (lower = higher).
alter table school_item add column if not exists position double precision not null default 0;

-- One-time backfill: seed position from due-date order.
-- Guarded so a re-run cannot clobber manual orderings (only touches users whose
-- rows are all still at the untouched default).
update school_item set position = sub.rn
from (
  select id, row_number() over (partition by user_id order by due_on, created_at) as rn
  from school_item
) sub
where school_item.id = sub.id
  and not exists (select 1 from school_item s2 where s2.user_id = school_item.user_id and s2.position <> 0);
