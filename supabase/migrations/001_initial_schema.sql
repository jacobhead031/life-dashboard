-- Life Dashboard — initial schema
-- Run this in the Supabase SQL editor for your project.
-- Every table has user_id (FK to auth.users) and updated_at.
-- Row-Level Security ensures users can only read/write their own rows.

-- ── monthly_goal ─────────────────────────────────────────────
create table public.monthly_goal (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  text          text not null,
  month         text not null,         -- YYYY-MM  (the month it belongs to)
  done          boolean not null default false,
  origin_month  text not null,         -- YYYY-MM  (month first created — for carry-over tags)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.monthly_goal enable row level security;

create policy "users manage own monthly_goals"
  on public.monthly_goal
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── target (yearly) ──────────────────────────────────────────
create table public.target (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('count', 'best')),
  current    numeric not null default 0,
  goal       numeric not null,
  unit       text,
  year       integer not null,
  updated_at timestamptz not null default now()
);

alter table public.target enable row level security;

create policy "users manage own targets"
  on public.target
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── book ─────────────────────────────────────────────────────
create table public.book (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  title         text not null,
  author        text not null,
  status        text not null check (status in ('reading', 'finished', 'abandoned')),
  current_page  integer,
  total_pages   integer,
  rating        integer check (rating between 1 and 5),
  notes         text,
  date_finished date,
  updated_at    timestamptz not null default now()
);

alter table public.book enable row level security;

create policy "users manage own books"
  on public.book
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── learning_track ───────────────────────────────────────────
create table public.learning_track (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  name             text not null,
  total_steps      integer not null default 1,
  completed_steps  integer not null default 0,
  current_label    text not null default '',
  accent           text not null default 'sky' check (accent in ('amber', 'sky')),
  updated_at       timestamptz not null default now()
);

alter table public.learning_track enable row level security;

create policy "users manage own learning_tracks"
  on public.learning_track
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── idea ─────────────────────────────────────────────────────
create table public.idea (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  tag        text not null,
  text       text not null,
  effort     text not null default '',
  archived   boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.idea enable row level security;

create policy "users manage own ideas"
  on public.idea
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── recurring_date (birthdays) ───────────────────────────────
create table public.recurring_date (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  month        integer not null check (month between 1 and 12),
  day          integer not null check (day between 1 and 31),
  relationship text,
  lead_days    integer not null default 7,
  updated_at   timestamptz not null default now()
);

alter table public.recurring_date enable row level security;

create policy "users manage own recurring_dates"
  on public.recurring_date
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── reflection ───────────────────────────────────────────────
create table public.reflection (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  updated_at timestamptz not null default now()
);

alter table public.reflection enable row level security;

create policy "users manage own reflections"
  on public.reflection
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── reflection_note ──────────────────────────────────────────
create table public.reflection_note (
  id            uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.reflection on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  text          text not null,
  created_at    timestamptz not null default now()
);

alter table public.reflection_note enable row level security;

create policy "users manage own reflection_notes"
  on public.reflection_note
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── sunrise_sunset ───────────────────────────────────────────
create table public.sunrise_sunset (
  user_id       uuid not null references auth.users on delete cascade,
  month         text not null,           -- YYYY-MM
  sunrise_done  boolean not null default false,
  sunset_done   boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.sunrise_sunset enable row level security;

create policy "users manage own sunrise_sunset"
  on public.sunrise_sunset
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── updated_at trigger ───────────────────────────────────────
-- Automatically updates updated_at on any row change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.monthly_goal
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.target
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.book
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.learning_track
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.idea
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.recurring_date
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.reflection
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.sunrise_sunset
  for each row execute function public.set_updated_at();
