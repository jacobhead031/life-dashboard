-- Life Dashboard — seed data
-- Paste this into the Supabase SQL editor and run it after the migration.
-- It uses (select id from auth.users limit 1) — assumes you've already
-- created exactly one user account in Authentication → Users.

do $$
declare
  uid          uuid := (select id from auth.users limit 1);
  cur_month    text := to_char(current_date, 'YYYY-MM');
  two_mo_ago   text := to_char(current_date - interval '2 months', 'YYYY-MM');
  cur_year     int  := extract(year from current_date)::int;
  r1_id        uuid;
  r2_id        uuid;
begin

  -- ── Monthly goals ─────────────────────────────────────────
  insert into public.monthly_goal (user_id, text, month, done, origin_month) values
    (uid, 'Finish sales module 3',  cur_month, true,  cur_month),
    (uid, 'Plan a date night',      cur_month, false, two_mo_ago),  -- carries over tag
    (uid, 'Ride 200 km total',      cur_month, false, cur_month),
    (uid, 'Edit one short video',   cur_month, false, cur_month);

  -- ── Idea bank ─────────────────────────────────────────────
  insert into public.idea (user_id, tag, text, effort) values
    (uid, 'book',      'The Pragmatic Programmer',          '~ a chapter'),
    (uid, 'guitar',    'Learn "Wish You Were Here"',        'intermediate'),
    (uid, 'guitar',    'Practice barre chords',             '15 min'),
    (uid, 'song idea', 'That riff in A minor you hummed',   'voice memo'),
    (uid, 'photo',     'Shoot a roll on manual mode',       'golden hour'),
    (uid, 'sales',     'Module 3 — handling objections',    '~ 25 min'),
    (uid, 'video',     'Edit your last bike ride clips',    '30 min'),
    (uid, 'ride',      'Scout a route toward 180 km',       'planning');

  -- ── Books ─────────────────────────────────────────────────
  insert into public.book (user_id, title, author, status, current_page, total_pages) values
    (uid, 'Educated', 'Tara Westover', 'reading', 120, 340);

  insert into public.book (user_id, title, author, status, rating, date_finished) values
    (uid, 'Atomic Habits',                    'James Clear',      'finished', 4, (current_date - interval '60 days')::date),
    (uid, 'Project Hail Mary',                'Andy Weir',        'finished', 5, (current_date - interval '30 days')::date),
    (uid, 'The Almanack of Naval Ravikant',   'Eric Jorgenson',   'finished', 3, (current_date - interval '14 days')::date);

  -- ── Learning tracks ───────────────────────────────────────
  insert into public.learning_track (user_id, name, total_steps, completed_steps, current_label, accent) values
    (uid, 'Sales course',   10, 2, 'module 2 complete',  'amber'),
    (uid, 'Photography',    10, 1, 'basics: exposure',   'sky'),
    (uid, 'Video editing',  10, 0, 'not started',        'sky');

  -- ── Yearly targets ────────────────────────────────────────
  insert into public.target (user_id, name, kind, current, goal, unit, year) values
    (uid, 'Songs on guitar',          'count',  2,   5,   null, cur_year),
    (uid, 'Bike 180 km in one day',   'best',   124, 180, 'km', cur_year);

  -- ── Sunrise & sunset ──────────────────────────────────────
  -- Sunrise done this month, sunset still pending
  insert into public.sunrise_sunset (user_id, month, sunrise_done, sunset_done)
    values (uid, cur_month, true, false);

  -- ── Reflections ───────────────────────────────────────────
  insert into public.reflection (user_id, name) values
    (uid, 'Put yourself first')
  returning id into r1_id;

  insert into public.reflection_note (reflection_id, user_id, text, created_at) values
    (r1_id, uid, 'said no to the weekend shift, felt right',
     now() - interval '2 days');

  insert into public.reflection (user_id, name) values
    (uid, 'Build my relationship')
  returning id into r2_id;

  insert into public.reflection_note (reflection_id, user_id, text, created_at) values
    (r2_id, uid, 'maybe plan something this week?',
     now() - interval '6 days');

  -- ── Birthday ──────────────────────────────────────────────
  -- Surfaces in ~3 days (adjust month/day if you want a different window)
  insert into public.recurring_date (user_id, name, month, day, relationship, lead_days)
  values (
    uid,
    'Mom',
    extract(month from current_date + interval '3 days')::int,
    extract(day   from current_date + interval '3 days')::int,
    'mother',
    7
  );

end;
$$;
