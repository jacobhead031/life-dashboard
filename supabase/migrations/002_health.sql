-- Health tab — daily metrics synced nightly from the health-coach Mac scripts.
-- One row per user per day; weight only filled on weigh-in days (Sundays).

-- ── health_day ───────────────────────────────────────────────
create table public.health_day (
  user_id      uuid not null references auth.users on delete cascade,
  date         date not null,
  recovery_pct numeric,
  hrv          numeric,          -- ms
  rhr          numeric,          -- bpm
  sleep_hours  numeric,
  strain       numeric,
  calories     numeric,
  protein      numeric,          -- g
  fat          numeric,          -- g
  carbs        numeric,          -- g
  weight       numeric,          -- unit-agnostic, Sundays only
  updated_at   timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.health_day enable row level security;

create policy "users manage own health_days"
  on public.health_day
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── health_recs (weekly Top 3 coaching targets) ──────────────
create table public.health_recs (
  user_id    uuid not null references auth.users on delete cascade,
  week_of    date not null,      -- the Sunday the deck was sent
  recs       text[] not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_of)
);

alter table public.health_recs enable row level security;

create policy "users manage own health_recs"
  on public.health_recs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.health_day
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.health_recs
  for each row execute function public.set_updated_at();
