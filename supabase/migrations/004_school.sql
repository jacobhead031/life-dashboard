-- School tab — classes (fixed weekly schedule) and assignments/exams.
-- Applied to the remote project via MCP apply_migration; archived here for the record.

-- ── school_class ─────────────────────────────────────────────
create table public.school_class (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  days       int[] not null default '{}',   -- ISO weekday: 1=Mon .. 7=Sun
  start_time time,
  created_at timestamptz not null default now()
);

alter table public.school_class enable row level security;

create policy "users manage own school_class"
  on public.school_class
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── school_item (assignment | exam) ──────────────────────────
create table public.school_item (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  class_id   uuid not null references public.school_class on delete cascade,
  title      text not null,
  kind       text not null check (kind in ('assignment', 'exam')),
  due_on     date not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.school_item enable row level security;

create policy "users manage own school_item"
  on public.school_item
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
