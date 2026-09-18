-- Baseline for tables that were created by hand in the SQL editor and never had a
-- migration: projects, notes, habit, habit_log, weekly_goal, budget_categories,
-- budget_settings, expenses. Transcribed from the live schema on 2026-09-18.
-- Idempotent, so it is a no-op against the live project and makes a fresh replay
-- work (003 alters `notes`, which nothing else creates).

do $$ begin
  create type public.area as enum ('career', 'personal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum ('active', 'seed', 'done');
exception when duplicate_object then null; end $$;

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── Projects / notes ─────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null,
  area        public.area not null,
  status      public.project_status not null default 'seed',
  next_action text, -- retired from the UI
  why         text,
  repo_url    text,
  live_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  touched_at  timestamptz not null default now()
);
create index if not exists projects_user_status_idx on public.projects (user_id, status, touched_at desc);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.update_updated_at();

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null, -- null = inbox
  body       text not null,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  done       boolean not null default false
  -- position: added by 003
);
create index if not exists notes_user_project_idx on public.notes (user_id, project_id, created_at desc);

-- ── Habits / weekly goals ────────────────────────────────────
create table if not exists public.habit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users,
  name       text not null,
  color      text not null default 'sky',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.habit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users,
  habit_id   uuid not null references public.habit on delete cascade,
  date       date not null,
  created_at timestamptz default now(),
  unique (habit_id, date)
);

create table if not exists public.weekly_goal (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users,
  text       text not null,
  week       date not null, -- Monday of the week
  done       boolean not null default false,
  target     integer not null default 0,
  current    integer not null default 0,
  created_at timestamptz default now()
);

-- ── Budget ───────────────────────────────────────────────────
create table if not exists public.budget_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  budget     numeric(10,2) check (budget > 0)
);

create table if not exists public.budget_settings (
  user_id   uuid primary key,
  allowance numeric(10,2) not null default 0
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  category_id uuid references public.budget_categories on delete set null,
  amount      numeric(10,2) not null check (amount > 0),
  note        text,
  spent_on    date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_user_spent_on_idx on public.expenses (user_id, spent_on desc);

-- ── RLS (owner-only, same as every other table) ──────────────
do $$
declare t text;
begin
  foreach t in array array['projects','notes','habit','habit_log','weekly_goal','budget_categories','budget_settings','expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        'own ' || t, t);
    end if;
  end loop;
end $$;
