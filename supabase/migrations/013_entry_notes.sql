-- The recipe, the review, the story: free text on every counter / goal entry.
alter table public.life_counter_entry add column if not exists notes text;
