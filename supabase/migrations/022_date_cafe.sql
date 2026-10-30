-- Coffee shops get their own sub-tab under restaurants on /dates, rated the same way.
alter table public.date_idea drop constraint if exists date_idea_kind_check;
alter table public.date_idea add constraint date_idea_kind_check check (kind in ('activity', 'restaurant', 'cafe'));
