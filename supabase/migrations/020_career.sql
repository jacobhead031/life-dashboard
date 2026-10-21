-- Career tab: the path to a medical device sales job. Four small tables the
-- Sunday career agent (~/health-coach/career_agent.py) and the tab both write.
create table if not exists public.career_todo (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  week       date not null,           -- Monday of the week it belongs to
  text       text not null,
  done       boolean not null default false,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists career_todo_week_idx on public.career_todo (user_id, week, position);

create table if not exists public.career_app (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null,
  company    text not null,
  location   text,
  term       text,
  status     text not null default 'to_apply' check (status in ('to_apply', 'applied', 'interview', 'offer', 'watch', 'closed')),
  url        text,
  notes      text,
  applied_on date,
  heard_on   date,
  source     text not null default 'manual', -- manual|agent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_contact (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  name           text not null,
  role           text,
  company        text,
  why            text,                 -- why they're relevant (shared school, specialty, recent move)
  channel        text not null default 'linkedin' check (channel in ('email', 'linkedin')),
  stage          text not null default 'found' check (stage in ('found', 'drafted', 'sent', 'replied', 'call', 'shadow')),
  email          text,
  linkedin_url   text,
  draft          text,                 -- the note to send (LinkedIn: Jacob pastes it; email: also a Gmail draft)
  sent_on        date,
  followup_sent  boolean not null default false,
  next_followup  date,
  last_touch     date,
  do_not_contact boolean not null default false,
  source         text not null default 'manual', -- manual|agent
  created_at     timestamptz not null default now()
);

create table if not exists public.career_win (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  happened_on date,
  text        text not null,
  metric      text,                    -- the number, where there is one
  created_at  timestamptz not null default now()
);

-- Months of sales-facing experience count from here (null = 0).
alter table public.user_settings add column if not exists sales_exp_since date;

do $$
declare t text;
begin
  foreach t in array array['career_todo', 'career_app', 'career_contact', 'career_win'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "users manage own %s" on public.%I', t, t);
    execute format('create policy "users manage own %s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
