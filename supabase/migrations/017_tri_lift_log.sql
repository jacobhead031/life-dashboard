-- Lift log: one row per set. The /coach/lift page pre-fills next time from the
-- last session of each exercise and suggests the progression step.
create table if not exists public.tri_lift_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  session_id uuid references public.tri_session on delete set null,
  exercise   text not null,
  set_no     int not null,
  reps       int,
  weight_lb  numeric,            -- bodyweight moves log 0
  rpe        int check (rpe between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists tri_lift_log_user_ex on public.tri_lift_log (user_id, exercise, date);
alter table public.tri_lift_log enable row level security;
drop policy if exists "users manage own tri_lift_log" on public.tri_lift_log;
create policy "users manage own tri_lift_log" on public.tri_lift_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
