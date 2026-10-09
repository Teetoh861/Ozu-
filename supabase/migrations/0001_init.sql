-- Ozu persistence schema. The game server connects with a privileged role (DATABASE_URL)
-- and is the only writer. Row-level security lets signed-in players read their own profile.

create table if not exists public.ozu_players (
  id            text primary key,           -- 'u_<auth uid>' for members, 'g_<uuid>' for guests
  display_name  text not null,
  coins         integer not null default 0 check (coins >= 0),
  rep           integer not null default 0 check (rep >= 0),
  banned        boolean not null default false,
  data          jsonb not null,             -- full player record (avatar, progress, blocks)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ozu_players_rep_idx on public.ozu_players (rep desc);

create table if not exists public.ozu_reports (
  id           uuid primary key,
  reporter_id  text not null,
  target_id    text not null,
  reason       text not null,
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  data         jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists ozu_reports_status_idx on public.ozu_reports (status, created_at desc);
create index if not exists ozu_reports_target_idx on public.ozu_reports (target_id);

alter table public.ozu_players enable row level security;
alter table public.ozu_reports enable row level security;

-- Members may read (never write) their own record. All writes go through the game server,
-- which validates every economy and progression change.
drop policy if exists "players read own record" on public.ozu_players;
create policy "players read own record" on public.ozu_players
  for select to authenticated
  using (id = 'u_' || auth.uid()::text);

-- Reports are visible only to the server/admin role (no policies = no client access).
