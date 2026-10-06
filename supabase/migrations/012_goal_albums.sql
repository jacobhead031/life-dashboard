-- Every goal gets an album too. life_goal.photo_path (the cover) now points at
-- one of the goal's own album images instead of a standalone upload.
alter table public.life_media add column if not exists goal_id uuid references public.life_goal on delete cascade;
alter table public.life_media alter column entry_id drop not null;

-- A file belongs to an entry's album or a goal's album, never both.
alter table public.life_media drop constraint if exists life_media_owner;
alter table public.life_media add constraint life_media_owner check ((entry_id is null) <> (goal_id is null));
create index if not exists life_media_goal_idx on public.life_media (goal_id, created_at);

-- One-time backfill: covers uploaded before albums existed become the first album image.
insert into public.life_media (user_id, goal_id, path, kind)
select g.user_id, g.id, g.photo_path, 'image'
from public.life_goal g
where g.photo_path is not null
  and not exists (select 1 from public.life_media m where m.path = g.photo_path);
