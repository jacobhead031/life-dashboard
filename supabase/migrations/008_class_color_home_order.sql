-- Per-class colour (hex, picked from the Google Calendar palette in the UI) and a
-- saved order for the home dashboard cards.
alter table school_class add column if not exists color text check (color ~ '^#[0-9a-fA-F]{6}$');

-- One-time backfill: the old colours were assigned by creation order
-- (amber, sky, green, coral); map them to the nearest Google Calendar colours.
update school_class c set color = (array['#F6BF26', '#039BE5', '#33B679', '#E67C73'])[1 + (sub.rn - 1) % 4]
from (select id, row_number() over (partition by user_id order by created_at) as rn from school_class) sub
where c.id = sub.id and c.color is null;

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users on delete cascade,
  home_order text[] not null default '{}' -- card ids, top to bottom; unknown/missing ids fall back to the default order
);

alter table public.user_settings enable row level security;

drop policy if exists "users manage own user_settings" on public.user_settings;
create policy "users manage own user_settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
