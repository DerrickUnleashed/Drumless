-- Store detected first beat phase so regen at a new BPM preserves alignment.
alter table public.tracks add column if not exists first_beat numeric;
