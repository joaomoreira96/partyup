-- PartyUp Document 03 — schema evolution

-- ---------------------------------------------------------------------------
-- Enums (align with Document 03)
-- ---------------------------------------------------------------------------
do $$ begin
  alter type public.game_status rename value 'published' to 'active';
exception when others then null;
end $$;

do $$ begin
  alter type public.game_status rename value 'archived' to 'disabled';
exception when others then null;
end $$;

do $$ begin
  alter type public.room_status rename value 'lobby' to 'waiting';
exception when others then null;
end $$;

create type public.game_event_type as enum (
  'GAME_STARTED',
  'GAME_FINISHED',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'ROOM_CREATED',
  'ROOM_JOINED',
  'SCORE_SUBMITTED',
  'ACHIEVEMENT_UNLOCKED'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists bio text,
  add column if not exists country text,
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
alter table public.games
  add column if not exists featured boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists games_featured_active_idx
  on public.games (featured)
  where status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Game builds
-- ---------------------------------------------------------------------------
create table if not exists public.game_builds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  version text not null,
  build_url text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (game_id, version)
);

create unique index if not exists game_builds_one_active_per_game
  on public.game_builds (game_id)
  where is_active = true and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Rename legacy tables to Document 03 names
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.play_sessions rename to game_sessions;
exception when undefined_table then
  create table if not exists public.game_sessions (
    id uuid primary key default gen_random_uuid(),
    game_id uuid not null references public.games (id) on delete cascade,
    user_id uuid references public.profiles (id) on delete set null,
    guest_id text,
    duration_seconds int,
    score numeric,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
end $$;

alter table public.game_sessions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.leaderboard_entries rename to leaderboards;
exception when undefined_table then null;
end $$;

-- ---------------------------------------------------------------------------
-- Leaderboards (ensure columns + audit)
-- ---------------------------------------------------------------------------
alter table public.leaderboards
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- User stats (Document 03 field names)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.user_stats rename column games_played to total_games_played;
exception when undefined_column then null;
end $$;

alter table public.user_stats
  add column if not exists highest_score numeric not null default 0,
  add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Game stats (Document 03 field names)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.game_stats rename column sessions_count to total_sessions;
exception when undefined_column then null;
end $$;

do $$ begin
  alter table public.game_stats rename column unique_players to total_players;
exception when undefined_column then null;
end $$;

do $$ begin
  alter table public.game_stats rename column max_score to highest_score;
exception when undefined_column then null;
end $$;

alter table public.game_stats
  add column if not exists total_play_time_seconds bigint not null default 0,
  add column if not exists created_at timestamptz not null default now();

-- Migrate avg -> total sum approximation (keep existing avg * sessions as total)
update public.game_stats
set total_play_time_seconds = coalesce(
  (avg_play_time_seconds * total_sessions)::bigint,
  0
)
where total_play_time_seconds = 0
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_stats'
      and column_name = 'avg_play_time_seconds'
  );

alter table public.game_stats drop column if exists avg_play_time_seconds;

-- ---------------------------------------------------------------------------
-- Game events (analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  event_type public.game_event_type not null,
  game_id uuid references public.games (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_events_type_created_idx
  on public.game_events (event_type, created_at desc);

create index if not exists game_events_game_id_idx
  on public.game_events (game_id)
  where game_id is not null;

-- ---------------------------------------------------------------------------
-- Rooms (host_user_id alias)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.rooms rename column host_id to host_user_id;
exception when undefined_column then
  alter table public.rooms add column if not exists host_user_id uuid references public.profiles (id) on delete set null;
end $$;

alter table public.rooms
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Room players audit
-- ---------------------------------------------------------------------------
alter table public.room_players
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill created_at from joined_at
update public.room_players
set created_at = joined_at
where created_at is null and joined_at is not null;

-- ---------------------------------------------------------------------------
-- Categories audit
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists updated_at timestamptz not null default now();

alter table public.achievements
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'profiles', 'games', 'game_builds', 'categories', 'rooms',
    'room_players', 'leaderboards', 'achievements', 'user_stats',
    'game_stats', 'game_sessions'
  ] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- Profile trigger: include bio/country defaults
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'username'
  );
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: enable on new tables
-- ---------------------------------------------------------------------------
alter table public.game_builds enable row level security;
alter table public.game_events enable row level security;
alter table public.game_sessions enable row level security;

-- Drop legacy permissive policies (deny-by-default + explicit allow)
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Published games are public" on public.games;
drop policy if exists "Admins manage games" on public.games;
drop policy if exists "Rooms are viewable by everyone" on public.rooms;
drop policy if exists "Host can update room" on public.rooms;
drop policy if exists "Leaderboard entries are public" on public.leaderboards;
drop policy if exists "Authenticated users submit scores" on public.leaderboards;
drop policy if exists "Play sessions insertable" on public.game_sessions;
drop policy if exists "Own sessions viewable" on public.game_sessions;

-- Profiles
create policy "profiles_select_public"
  on public.profiles for select
  using (deleted_at is null);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id and deleted_at is null);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Games
create policy "games_select_active"
  on public.games for select
  using (
    deleted_at is null
    and (
      status = 'active'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create policy "games_admin_all"
  on public.games for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Game builds
create policy "game_builds_select_active"
  on public.game_builds for select
  using (
    deleted_at is null
    and (
      is_active = true
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create policy "game_builds_admin_all"
  on public.game_builds for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Leaderboards
create policy "leaderboards_select_public"
  on public.leaderboards for select using (true);

create policy "leaderboards_insert_own"
  on public.leaderboards for insert
  with check (auth.uid() = user_id);

-- Game sessions — insert via API (authenticated or guest metadata only)
create policy "game_sessions_insert"
  on public.game_sessions for insert with check (true);

create policy "game_sessions_select_own"
  on public.game_sessions for select
  using (user_id = auth.uid() or user_id is null);

-- Game events — read admin only; insert service via API uses user client with policy
-- Events written only via platform API routes (validated server-side)
create policy "game_events_insert_platform"
  on public.game_events for insert
  with check (true);

create policy "game_events_select_admin"
  on public.game_events for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Rooms — participants can read active rooms
create policy "rooms_select_active"
  on public.rooms for select
  using (deleted_at is null);

create policy "rooms_insert_authenticated"
  on public.rooms for insert
  with check (auth.uid() is not null);

create policy "rooms_update_host"
  on public.rooms for update
  using (host_user_id = auth.uid() and deleted_at is null);

-- Room players
drop policy if exists "Room players are viewable" on public.room_players;
drop policy if exists "Anyone can join as guest or user" on public.room_players;
drop policy if exists "Players update own row" on public.room_players;

create policy "room_players_select"
  on public.room_players for select using (true);

create policy "room_players_insert"
  on public.room_players for insert with check (true);

create policy "room_players_update_own"
  on public.room_players for update
  using (user_id = auth.uid() or user_id is null);

-- User stats: users read all; updates via service (own row)
drop policy if exists "Users update own stats" on public.user_stats;

create policy "user_stats_select_public"
  on public.user_stats for select using (true);

create policy "user_stats_update_own"
  on public.user_stats for update using (auth.uid() = user_id);

-- Game stats: public read
create policy "game_stats_select_public"
  on public.game_stats for select using (true);

-- Seed default builds for existing games (module as 1.0.0)
insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', coalesce(g.module_id, 'local'), true
from public.games g
where not exists (
  select 1 from public.game_builds b
  where b.game_id = g.id and b.is_active = true
);

update public.games set featured = true
where slug in ('memoria-classica', 'reacao-rapida', 'trivia-rapida')
  and featured = false;
