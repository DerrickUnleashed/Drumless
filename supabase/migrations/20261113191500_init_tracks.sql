-- Drumless initial schema: tracks table, RLS, private audio bucket + policies.

create extension if not exists pgcrypto;

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  original_song_name text not null,
  custom_name text,
  source_url text,
  original_storage_path text,
  backing_storage_path text,
  mixed_storage_path text,
  bpm numeric,
  click_gain_db numeric,
  duration_seconds numeric,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracks_user_id_created_at_idx
  on public.tracks (user_id, created_at desc);

create index if not exists tracks_status_idx
  on public.tracks (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracks_set_updated_at on public.tracks;
create trigger tracks_set_updated_at
  before update on public.tracks
  for each row execute function public.set_updated_at();

alter table public.tracks enable row level security;

drop policy if exists "tracks_select_own" on public.tracks;
create policy "tracks_select_own"
  on public.tracks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tracks_insert_own" on public.tracks;
create policy "tracks_insert_own"
  on public.tracks for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tracks_update_own" on public.tracks;
create policy "tracks_update_own"
  on public.tracks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tracks_delete_own" on public.tracks;
create policy "tracks_delete_own"
  on public.tracks for delete
  to authenticated
  using (auth.uid() = user_id);

-- Private audio bucket. Files live at {user_id}/{track_id}/{filename}.
insert into storage.buckets (id, name, public)
values ('drumless-audio', 'drumless-audio', false)
on conflict (id) do update set public = false;

drop policy if exists "drumless_audio_select_own" on storage.objects;
create policy "drumless_audio_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'drumless-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "drumless_audio_insert_own" on storage.objects;
create policy "drumless_audio_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'drumless-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "drumless_audio_update_own" on storage.objects;
create policy "drumless_audio_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'drumless-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'drumless-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "drumless_audio_delete_own" on storage.objects;
create policy "drumless_audio_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'drumless-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
