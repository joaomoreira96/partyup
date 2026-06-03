-- PartyUp platform schema

create type public.user_role as enum ('user', 'admin');
create type public.game_status as enum ('draft', 'published', 'archived');
create type public.room_status as enum ('lobby', 'playing', 'finished');
create type public.leaderboard_metric as enum ('score', 'time', 'streak');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text not null default '',
  avatar_url text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  thumbnail_url text,
  banner_url text,
  module_id text not null,
  guest_allowed boolean not null default true,
  supports_multiplayer boolean not null default false,
  supports_desktop boolean not null default true,
  supports_tablet boolean not null default true,
  supports_mobile boolean not null default true,
  status public.game_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_categories (
  game_id uuid not null references public.games (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (game_id, category_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game_id uuid not null references public.games (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete set null,
  status public.room_status not null default 'lobby',
  max_players int not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_name text,
  is_ready boolean not null default false,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  constraint room_players_identity check (
    user_id is not null or guest_name is not null
  )
);

create unique index room_players_user_unique on public.room_players (room_id, user_id)
  where user_id is not null;

create table public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score numeric not null,
  metric public.leaderboard_metric not null default 'score',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index leaderboard_game_metric_score on public.leaderboard_entries (
  game_id, metric, score desc
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.user_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  games_played int not null default 0,
  total_play_time_seconds int not null default 0,
  total_score numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.game_stats (
  game_id uuid primary key references public.games (id) on delete cascade,
  sessions_count int not null default 0,
  unique_players int not null default 0,
  avg_play_time_seconds numeric not null default 0,
  max_score numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  guest_id text,
  duration_seconds int,
  score numeric,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Auto-create profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.games enable row level security;
alter table public.game_categories enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_stats enable row level security;
alter table public.game_stats enable row level security;
alter table public.play_sessions enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Categories are public"
  on public.categories for select using (true);

create policy "Published games are public"
  on public.games for select
  using (status = 'published' or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins manage games"
  on public.games for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Game categories are public"
  on public.game_categories for select using (true);

create policy "Rooms are viewable by everyone"
  on public.rooms for select using (true);

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check (auth.uid() is not null);

create policy "Host can update room"
  on public.rooms for update
  using (host_id = auth.uid());

create policy "Room players are viewable"
  on public.room_players for select using (true);

create policy "Anyone can join as guest or user"
  on public.room_players for insert with check (true);

create policy "Players update own row"
  on public.room_players for update
  using (user_id = auth.uid() or user_id is null);

create policy "Leaderboard entries are public"
  on public.leaderboard_entries for select using (true);

create policy "Authenticated users submit scores"
  on public.leaderboard_entries for insert
  with check (auth.uid() = user_id);

create policy "Achievements are public"
  on public.achievements for select using (true);

create policy "User achievements viewable"
  on public.user_achievements for select using (true);

create policy "System inserts user achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create policy "User stats viewable"
  on public.user_stats for select using (true);

create policy "Users update own stats"
  on public.user_stats for update using (auth.uid() = user_id);

create policy "Game stats are public"
  on public.game_stats for select using (true);

create policy "Play sessions insertable"
  on public.play_sessions for insert with check (true);

create policy "Own sessions viewable"
  on public.play_sessions for select
  using (user_id = auth.uid() or user_id is null);
