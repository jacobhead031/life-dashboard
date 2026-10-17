-- Stats tab: VO2 max and steps from Intervals.icu wellness (Garmin), alongside WHOOP.
alter table public.health_day add column if not exists vo2max numeric;
alter table public.health_day add column if not exists steps int;
