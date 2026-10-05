-- Life goals: the "This Year" home card and the /life list. Seeded from
-- lib/life-goals.json by the seedLifeGoals action, not by this file.
create table if not exists public.life_goal (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  slug            text not null, -- stable id from the seed file; `requires` points at these
  title           text not null,
  emoji           text not null default '',
  category        text not null check (category in ('Adventure', 'Body', 'Build', 'Skills', 'People', 'Mind')),
  type            text not null default 'experience' check (type in ('experience', 'ladder', 'count', 'countdown', 'habit')),
  active          boolean not null default false, -- shows on the home card
  status          text not null default 'someday' check (status in ('someday', 'active', 'done')),
  why             text,
  first_move      text,
  next_move       text,
  target_date     date,
  steps           jsonb not null default '[]', -- [{ label, done, doneDate? }] in ladder order
  count_current   int not null default 0,
  season_target   int,
  lifetime_target int,
  requires        text[] not null default '{}', -- slugs that must be done first
  image_query     text,
  cover_url       text, -- stock cover (Unsplash or pasted by hand)
  cover_credit    text,
  photo_path      text, -- my own photo in the goal-photos bucket; wins over cover_url
  completed_on    date,
  notes           text,
  position        double precision not null default 0, -- lower = earlier on the wall and in the daily rotation
  created_at      timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.life_counter_entry (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  counter     text not null check (counter in ('countries', 'continents', 'wonders', 'concerts')),
  name        text not null,
  happened_on date,
  created_at  timestamptz not null default now()
);

-- One row each time "Today's move" is pressed done.
create table if not exists public.life_move_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid not null references public.life_goal on delete cascade,
  move    text not null,
  done_on date not null
);

create table if not exists public.journal_log (
  user_id uuid not null references auth.users on delete cascade,
  date    date not null,
  primary key (user_id, date)
);

alter table public.user_settings add column if not exists journal_start date;

do $$
declare t text;
begin
  foreach t in array array['life_goal', 'life_counter_entry', 'life_move_log', 'journal_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "users manage own %s" on public.%I', t, t);
    execute format('create policy "users manage own %s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- Private bucket for completion photos: <user_id>/<goal_id>/<ts>-<filename>.
insert into storage.buckets (id, name, public)
values ('goal-photos', 'goal-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "own goal photos" on storage.objects;
create policy "own goal photos"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'goal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'goal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
