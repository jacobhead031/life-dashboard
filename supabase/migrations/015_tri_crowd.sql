-- Crowd rating on swim check-ins (1 quiet .. 5 packed); the Weekly Builder
-- prefers the quietest pool slots that fit the week.
alter table public.tri_checkin add column if not exists crowd int check (crowd between 1 and 5);
