-- Applications are ranked: lower = apply first. The Sunday agent proposes the order; Jacob drags to override.
alter table public.career_app add column if not exists position double precision not null default 0;
