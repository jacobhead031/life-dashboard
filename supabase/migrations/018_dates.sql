-- Dates: a bucket list for two. Rows belong to whoever added them; the partner
-- named in user_settings.partner_id reads and edits them too. Done ideas keep
-- photos (date_media), a shared review, and one score per person (date_score).
alter table public.user_settings add column if not exists partner_id uuid references auth.users on delete set null;

-- True for my own rows and for rows of anyone who lists me as their partner.
-- security definer: user_settings RLS only shows a user their own row.
create or replace function public.shared_with_me(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or exists (select 1 from user_settings where user_id = owner and partner_id = auth.uid());
$$;

create table if not exists public.date_idea (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade, -- who added it
  title       text not null,
  note        text,
  url         text,
  category    text not null default 'other', -- food|outdoors|indoors|event|show|game|make|trip|home|other…
  cost        text not null default '$' check (cost in ('free', '$', '$$', '$$$')),
  duration    text not null default 'evening' check (duration in ('1h', 'evening', 'half day', 'full day')),
  event_on    date,  -- dated things: first day; null = anytime
  event_until date,  -- last day; the weekly job deletes its own rows once this has passed
  source      text not null default 'manual', -- manual|seed|weekly
  want_more   boolean not null default false,
  position    double precision not null default 0, -- lower = higher in the list
  done_on     date,
  review      text,
  created_at  timestamptz not null default now()
);
create index if not exists date_idea_user_idx on public.date_idea (user_id, position);

create table if not exists public.date_score (
  idea_id    uuid not null references public.date_idea on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  score      int not null check (score between 1 and 10),
  primary key (idea_id, user_id)
);

create table if not exists public.date_media (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.date_idea on delete cascade,
  user_id    uuid not null references auth.users on delete cascade, -- who uploaded it
  path       text not null, -- date-photos bucket: <idea_id>/<ts>-<filename>
  kind       text not null check (kind in ('image', 'video')),
  created_at timestamptz not null default now()
);
create index if not exists date_media_idea_idx on public.date_media (idea_id, created_at);

alter table public.date_idea enable row level security;
alter table public.date_score enable row level security;
alter table public.date_media enable row level security;

drop policy if exists "pair manages date_idea" on public.date_idea;
create policy "pair manages date_idea" on public.date_idea
  for all using (public.shared_with_me(user_id)) with check (public.shared_with_me(user_id));

-- Scores and media hang off an idea; seeing the idea is the whole test. A score is only ever your own.
drop policy if exists "pair reads date_score" on public.date_score;
create policy "pair reads date_score" on public.date_score
  for select using (exists (select 1 from public.date_idea i where i.id = idea_id));
drop policy if exists "own date_score" on public.date_score;
create policy "own date_score" on public.date_score
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.date_idea i where i.id = idea_id));

drop policy if exists "pair manages date_media" on public.date_media;
create policy "pair manages date_media" on public.date_media
  for all using (exists (select 1 from public.date_idea i where i.id = idea_id))
  with check (user_id = auth.uid() and exists (select 1 from public.date_idea i where i.id = idea_id));

-- Private bucket; the first path segment is the idea, so both partners can read and write its folder.
insert into storage.buckets (id, name, public)
values ('date-photos', 'date-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "pair date photos" on storage.objects;
create policy "pair date photos"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'date-photos' and exists (select 1 from public.date_idea i where i.id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'date-photos' and exists (select 1 from public.date_idea i where i.id::text = (storage.foldername(name))[1]));
