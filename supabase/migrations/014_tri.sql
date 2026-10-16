-- Triathlon coach (IRONMAN 70.3 Maine). Planned and completed sessions,
-- check-ins, gear and the coach chat. Written by the ~/health-coach agents
-- (service key, explicit user_id) and the /coach tab (RLS).
-- Design: docs/superpowers/specs/2026-10-15-tri-coach-design.md

-- One row per user: race goal, current zones, life constraints.
create table if not exists public.tri_profile (
  user_id       uuid primary key references auth.users on delete cascade,
  race_date     date not null,
  goal_s        int not null,            -- seconds; 5:45:00 = 20700
  floor_s       int,
  stretch_s     int,
  ftp_watts     int,
  css_s_100m    int,                     -- critical swim speed, s per 100 m
  thr_run_s_km  int,                     -- threshold run pace, s per km
  lthr          int,
  max_hr        int,
  weight_kg     numeric,
  hockey_days   int[] not null default '{2,7}',   -- ISO weekday 1=Mon..7=Sun
  pool_slots    jsonb not null default '[]',      -- [{ pool, weekday, start, end, valid_from, valid_to }]
  updated_at    timestamptz not null default now()
);

create table if not exists public.tri_phase (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users on delete cascade,
  name      text not null,
  start_on  date not null,
  end_on    date not null,
  focus     text,
  hours_min numeric,
  hours_max numeric
);

-- Planned sessions. Tests and races are sessions too (sport = 'test' | 'race').
create table if not exists public.tri_session (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  date               date not null,
  slot               text not null default 'am' check (slot in ('am', 'pm')),
  sport              text not null check (sport in ('swim', 'bike', 'run', 'brick', 'strength', 'hockey', 'mobility', 'test', 'race', 'rest')),
  title              text not null,
  purpose            text,                -- the one-line "why"
  duration_min       int,
  structure          text,                -- Intervals.icu workout text ("- 10m 60%" lines)
  is_key             boolean not null default false,
  location           text,                -- TPASC | Athletic Centre | Zwift | treadmill | outdoor
  status             text not null default 'planned' check (status in ('planned', 'adjusted', 'done', 'partial', 'skipped', 'moved')),
  adjusted_reason    text,
  intervals_event_id text,
  created_by         text not null default 'weekly' check (created_by in ('season', 'weekly', 'daily', 'user')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists tri_session_user_date on public.tri_session (user_id, date);

-- Completed activities pulled from Intervals.icu (Garmin / Zwift truth).
create table if not exists public.tri_activity (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  intervals_activity_id text not null,
  session_id            uuid references public.tri_session on delete set null,
  date                  date not null,
  sport                 text,
  duration_s            int,
  distance_m            numeric,
  avg_hr                int,
  avg_watts             int,
  np_watts              int,
  pace_s_km             numeric,
  load                  numeric,
  raw                   jsonb,
  created_at            timestamptz not null default now(),
  unique (user_id, intervals_activity_id)
);

create table if not exists public.tri_checkin (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  session_id uuid references public.tri_session on delete set null,
  date       date not null,
  kind       text not null default 'post_session' check (kind in ('post_session', 'post_hockey', 'weekly', 'adhoc')),
  channel    text not null default 'tab' check (channel in ('email', 'tab', 'voice')),
  rpe        int check (rpe between 1 and 10),
  legs       text,
  sleep      text,
  mood       text,
  pain       boolean not null default false,
  pain_where text,
  notes      text,
  raw_text   text,
  created_at timestamptz not null default now()
);

create table if not exists public.tri_gear (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users on delete cascade,
  rank     int,
  item     text not null,
  area     text,
  buy_by   date,
  status   text not null default 'need' check (status in ('have', 'shopping', 'need', 'ordered')),
  why      text
);

-- Coach chat; voice turns are saved as text too.
create table if not exists public.tri_message (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('athlete', 'coach')),
  channel    text not null default 'tab' check (channel in ('email', 'tab', 'voice')),
  content    text not null,
  session_id uuid references public.tri_session on delete set null,
  created_at timestamptz not null default now()
);

-- health_day doubles as whoop_daily + nutrition_daily. push_health.py only
-- sends its own columns with merge-duplicates, so these survive the sync.
alter table public.health_day add column if not exists target_carbs_g   int;
alter table public.health_day add column if not exists target_protein_g int;
alter table public.health_day add column if not exists ctl numeric;   -- fitness, from Intervals.icu wellness
alter table public.health_day add column if not exists atl numeric;   -- fatigue

do $$
declare t text;
begin
  foreach t in array array['tri_profile', 'tri_phase', 'tri_session', 'tri_activity', 'tri_checkin', 'tri_gear', 'tri_message'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "users manage own %s" on public.%I', t, t);
    execute format('create policy "users manage own %s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

drop trigger if exists set_updated_at on public.tri_profile;
create trigger set_updated_at before update on public.tri_profile
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.tri_session;
create trigger set_updated_at before update on public.tri_session
  for each row execute function public.set_updated_at();
