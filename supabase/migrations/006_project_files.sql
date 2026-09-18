-- Project file attachments. The UI shipped without this table or any storage
-- policy, so uploads always failed; the bucket was also public. Bucket was empty
-- when this ran (2026-09-18), so making it private broke no links.
create table if not exists public.project_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  name       text not null,
  path       text not null, -- storage object name: <user_id>/<project_id>/<ts>-<filename>
  size       bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists project_files_project_idx on public.project_files (project_id, created_at desc);

alter table public.project_files enable row level security;

drop policy if exists "users manage own project_files" on public.project_files;
create policy "users manage own project_files"
  on public.project_files
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private bucket; files are served through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do update set public = false;

-- First path segment must be the caller's user id.
drop policy if exists "own project files" on storage.objects;
create policy "own project files"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text);
