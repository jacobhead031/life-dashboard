-- Albums: every counter entry (a country, a concert) can hold photos and videos,
-- and count goals get named entries too (a song, a dish) with the same album.
alter table public.life_counter_entry add column if not exists goal_id uuid references public.life_goal on delete cascade;
alter table public.life_counter_entry alter column counter drop not null;

-- An entry belongs to a counter or to a goal, never both.
alter table public.life_counter_entry drop constraint if exists life_counter_entry_owner;
alter table public.life_counter_entry add constraint life_counter_entry_owner check ((counter is null) <> (goal_id is null));

create table if not exists public.life_media (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  entry_id   uuid not null references public.life_counter_entry on delete cascade,
  path       text not null, -- goal-photos bucket: <user_id>/<entry_id>/<ts>-<filename>
  kind       text not null check (kind in ('image', 'video')),
  created_at timestamptz not null default now()
);
create index if not exists life_media_entry_idx on public.life_media (entry_id, created_at);

alter table public.life_media enable row level security;

drop policy if exists "users manage own life_media" on public.life_media;
create policy "users manage own life_media"
  on public.life_media
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
