-- Run this once in Supabase SQL Editor.
-- It adds the tiny JSON sync tables needed by the current app shell.

create table if not exists public.couple_state (
  vault_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists public.game_sessions (
  session_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

alter table public.couple_state replica identity full;
alter table public.game_sessions replica identity full;

alter publication supabase_realtime add table public.couple_state;
alter publication supabase_realtime add table public.game_sessions;

-- Optional if you enable Row Level Security. This app uses a private vault code
-- and a publishable anon key, so these policies intentionally allow app clients.
alter table public.couple_state enable row level security;
alter table public.game_sessions enable row level security;

drop policy if exists "couple_state app access" on public.couple_state;
create policy "couple_state app access"
on public.couple_state
for all
using (length(vault_id) >= 6)
with check (length(vault_id) >= 6);

drop policy if exists "game_sessions app access" on public.game_sessions;
create policy "game_sessions app access"
on public.game_sessions
for all
using (length(session_id) >= 6)
with check (length(session_id) >= 6);
