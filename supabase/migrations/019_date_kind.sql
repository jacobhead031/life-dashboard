-- Restaurants are their own section on /dates: added with a cuisine instead of a
-- time, listed on the restaurants tab whether eaten at yet or not.
alter table public.date_idea add column if not exists kind text not null default 'activity'
  check (kind in ('activity', 'restaurant'));
