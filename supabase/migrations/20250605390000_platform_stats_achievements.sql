-- Platform stats, per-game bests, streaks, and automatic platform achievements

-- ---------------------------------------------------------------------------
-- Schema extensions (hosted + local compatible)
-- ---------------------------------------------------------------------------

alter table public.user_stats
  add column if not exists rooms_created bigint not null default 0,
  add column if not exists rooms_joined bigint not null default 0,
  add column if not exists achievements_unlocked integer not null default 0,
  add column if not exists last_played_at timestamptz;

alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_active_date date;

alter table public.achievements
  add column if not exists code text,
  add column if not exists slug text,
  add column if not exists icon text,
  add column if not exists icon_url text,
  add column if not exists category text,
  add column if not exists metric text,
  add column if not exists target_value bigint,
  add column if not exists points integer not null default 0,
  add column if not exists hidden boolean not null default false;

update public.achievements
set code = coalesce(code, slug)
where code is null and slug is not null;

update public.achievements
set slug = coalesce(slug, lower(code))
where slug is null and code is not null;

update public.achievements
set icon = coalesce(icon, icon_url)
where icon is null and icon_url is not null;

update public.achievements
set icon_url = coalesce(icon_url, icon)
where icon_url is null and icon is not null;

create unique index if not exists achievements_code_key
  on public.achievements (code)
  where code is not null;

create unique index if not exists achievements_slug_key
  on public.achievements (slug)
  where slug is not null;

alter table public.user_achievements
  add column if not exists unlocked_at timestamptz,
  add column if not exists earned_at timestamptz;

update public.user_achievements
set unlocked_at = coalesce(unlocked_at, earned_at)
where unlocked_at is null and earned_at is not null;

update public.user_achievements
set earned_at = coalesce(earned_at, unlocked_at)
where earned_at is null and unlocked_at is not null;

alter table public.user_achievements
  alter column unlocked_at set default now();

create unique index if not exists user_achievements_user_achievement_key
  on public.user_achievements (user_id, achievement_id);

create table if not exists public.user_game_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  best_score integer not null default 0,
  sessions_played integer not null default 0,
  play_time_seconds bigint not null default 0,
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.user_game_stats enable row level security;

drop policy if exists "user_game_stats_select" on public.user_game_stats;
create policy "user_game_stats_select"
  on public.user_game_stats for select using (true);

create unique index if not exists leaderboards_game_user_key
  on public.leaderboards (game_id, user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.update_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_last date;
  v_current integer := 0;
  v_longest integer := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select p.last_active_date, coalesce(p.current_streak, 0), coalesce(p.longest_streak, 0)
  into v_last, v_current, v_longest
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return;
  end if;

  if v_last = v_today then
    return;
  elsif v_last = v_today - 1 then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.profiles
  set
    current_streak = v_current,
    longest_streak = v_longest,
    last_active_date = v_today,
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.grant_user_achievement(
  p_user_id uuid,
  p_achievement_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_unlocked_at boolean;
  v_has_earned_at boolean;
  v_has_id boolean;
  v_rows integer := 0;
  v_achievement record;
begin
  if p_user_id is null or p_achievement_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.user_achievements ua
    where ua.user_id = p_user_id
      and ua.achievement_id = p_achievement_id
  ) then
    return false;
  end if;

  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_achievements' and column_name = 'unlocked_at'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_achievements' and column_name = 'earned_at'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_achievements' and column_name = 'id'
    )
  into v_has_unlocked_at, v_has_earned_at, v_has_id;

  if v_has_unlocked_at and v_has_earned_at then
    insert into public.user_achievements (user_id, achievement_id, unlocked_at, earned_at)
    values (p_user_id, p_achievement_id, now(), now())
    on conflict (user_id, achievement_id) do nothing;
  elsif v_has_unlocked_at then
    insert into public.user_achievements (user_id, achievement_id, unlocked_at)
    values (p_user_id, p_achievement_id, now())
    on conflict (user_id, achievement_id) do nothing;
  elsif v_has_earned_at then
    if v_has_id then
      insert into public.user_achievements (id, user_id, achievement_id, earned_at)
      values (gen_random_uuid(), p_user_id, p_achievement_id, now())
      on conflict do nothing;
    else
      insert into public.user_achievements (user_id, achievement_id, earned_at)
      values (p_user_id, p_achievement_id, now())
      on conflict (user_id, achievement_id) do nothing;
    end if;
  else
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, p_achievement_id)
    on conflict (user_id, achievement_id) do nothing;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  select
    a.id,
    coalesce(a.code, a.slug) as code,
    a.name,
    a.points
  into v_achievement
  from public.achievements a
  where a.id = p_achievement_id;

  begin
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'game_events' and column_name = 'event_type'
    ) then
      insert into public.game_events (user_id, event_type, payload)
      values (
        p_user_id,
        'ACHIEVEMENT_UNLOCKED',
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'code', v_achievement.code,
          'name', v_achievement.name,
          'points', v_achievement.points
        )
      );
    end if;
  exception
    when others then
      raise warning 'grant_user_achievement: game_events insert failed: %', sqlerrm;
  end;

  return true;
end;
$$;

create or replace function public.evaluate_platform_achievements(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_metric_value bigint := 0;
  v_unlocked jsonb := '[]'::jsonb;
  v_granted boolean;
begin
  if p_user_id is null then
    return '[]'::json;
  end if;

  for rec in
    select
      a.id,
      coalesce(a.code, a.slug) as code,
      a.name,
      a.description,
      coalesce(a.icon, a.icon_url, 'trophy') as icon,
      a.metric,
      a.target_value,
      a.points
    from public.achievements a
    where a.category = 'platform'
      and a.metric is not null
      and a.target_value is not null
      and not exists (
        select 1
        from public.user_achievements ua
        where ua.user_id = p_user_id
          and ua.achievement_id = a.id
      )
    order by a.target_value asc
  loop
    v_metric_value := 0;

    if rec.metric = 'games_played' then
      select coalesce(us.total_games_played, 0)::bigint
      into v_metric_value
      from public.user_stats us
      where us.user_id = p_user_id;
    elsif rec.metric = 'total_play_time_seconds' then
      select coalesce(us.total_play_time_seconds, 0)::bigint
      into v_metric_value
      from public.user_stats us
      where us.user_id = p_user_id;
    elsif rec.metric = 'total_score' then
      select coalesce(us.total_score, 0)::bigint
      into v_metric_value
      from public.user_stats us
      where us.user_id = p_user_id;
    elsif rec.metric = 'current_streak' then
      select coalesce(p.current_streak, 0)::bigint
      into v_metric_value
      from public.profiles p
      where p.id = p_user_id;
    else
      continue;
    end if;

    if v_metric_value >= rec.target_value then
      v_granted := public.grant_user_achievement(p_user_id, rec.id);
      if v_granted then
        v_unlocked := v_unlocked || jsonb_build_array(
          jsonb_build_object(
            'id', rec.id,
            'code', rec.code,
            'name', rec.name,
            'description', rec.description,
            'icon', rec.icon,
            'points', rec.points
          )
        );
      end if;
    end if;
  end loop;

  update public.user_stats us
  set
    achievements_unlocked = (
      select count(*)::integer
      from public.user_achievements ua
      where ua.user_id = p_user_id
    ),
    updated_at = now()
  where us.user_id = p_user_id;

  return v_unlocked::json;
end;
$$;

create or replace function public.upsert_leaderboard_best_score(
  p_game_id uuid,
  p_user_id uuid,
  p_score integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev integer := 0;
  v_updated boolean := false;
begin
  if p_game_id is null or p_user_id is null then
    raise exception 'invalid_leaderboard_args' using errcode = 'P0001';
  end if;

  select lb.score
  into v_prev
  from public.leaderboards lb
  where lb.game_id = p_game_id
    and lb.user_id = p_user_id;

  if not found then
    insert into public.leaderboards (game_id, user_id, score, achieved_at)
    values (p_game_id, p_user_id, p_score, now());
    return json_build_object('ok', true, 'updated', true, 'previous_score', null);
  end if;

  if p_score > v_prev then
    update public.leaderboards
    set score = p_score, achieved_at = now()
    where game_id = p_game_id and user_id = p_user_id;
    v_updated := true;
  end if;

  return json_build_object(
    'ok', true,
    'updated', v_updated,
    'previous_score', v_prev
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Session stats trigger: user_stats, user_game_stats, streak
-- ---------------------------------------------------------------------------

create or replace function public.apply_session_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur bigint := coalesce(new.duration_seconds, 0)::bigint;
  v_sc bigint := coalesce(new.score, 0)::bigint;
  v_is_new_player boolean;
  v_module_id text := '';
  v_is_time_metric boolean := false;
begin
  select coalesce(g.module_id, '')
  into v_module_id
  from public.games g
  where g.id = new.game_id;

  v_is_time_metric := v_module_id = 'reaction';

  if new.user_id is not null then
    insert into public.user_stats (
      user_id,
      total_games_played,
      total_play_time_seconds,
      total_score,
      highest_score,
      last_played_at,
      updated_at
    )
    values (new.user_id, 1, v_dur, v_sc, v_sc::integer, now(), now())
    on conflict (user_id) do update
    set
      total_games_played = user_stats.total_games_played + 1,
      total_play_time_seconds = user_stats.total_play_time_seconds + v_dur,
      total_score = user_stats.total_score + v_sc,
      highest_score = greatest(user_stats.highest_score, v_sc::integer),
      last_played_at = now(),
      updated_at = now();

    insert into public.user_game_stats (
      user_id,
      game_id,
      best_score,
      sessions_played,
      play_time_seconds,
      first_played_at,
      last_played_at,
      updated_at
    )
    values (
      new.user_id,
      new.game_id,
      v_sc::integer,
      1,
      v_dur,
      now(),
      now(),
      now()
    )
    on conflict (user_id, game_id) do update
    set
      sessions_played = user_game_stats.sessions_played + 1,
      play_time_seconds = user_game_stats.play_time_seconds + v_dur,
      best_score = case
        when v_is_time_metric then
          case
            when user_game_stats.best_score <= 0 and v_sc::integer > 0 then v_sc::integer
            when v_sc::integer <= 0 then user_game_stats.best_score
            when user_game_stats.best_score <= 0 then v_sc::integer
            else least(user_game_stats.best_score, v_sc::integer)
          end
        else greatest(user_game_stats.best_score, v_sc::integer)
      end,
      last_played_at = now(),
      updated_at = now();

    perform public.update_user_streak(new.user_id);
  end if;

  if new.user_id is not null then
    select not exists (
      select 1
      from public.game_sessions gs
      where gs.game_id = new.game_id
        and gs.user_id = new.user_id
        and gs.id <> new.id
    ) into v_is_new_player;
  else
    v_is_new_player := false;
  end if;

  insert into public.game_stats (
    game_id,
    total_sessions,
    total_play_time_seconds,
    highest_score,
    total_players,
    updated_at
  )
  values (
    new.game_id,
    1,
    v_dur,
    v_sc::integer,
    case when v_is_new_player then 1 else 0 end,
    now()
  )
  on conflict (game_id) do update
  set
    total_sessions = game_stats.total_sessions + 1,
    total_play_time_seconds = game_stats.total_play_time_seconds + v_dur,
    highest_score = greatest(game_stats.highest_score, v_sc::integer),
    total_players = game_stats.total_players + case when v_is_new_player then 1 else 0 end,
    updated_at = now();

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_game_session: evaluate achievements after stats trigger
-- ---------------------------------------------------------------------------

create or replace function public.record_game_session(
  p_game_id uuid,
  p_user_id uuid default null,
  p_duration_seconds integer default 0,
  p_score integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_has_metadata boolean;
  v_round_id text;
  v_player_id text;
  v_unlocked json := '[]'::json;
begin
  if p_game_id is null then
    raise exception 'game_required' using errcode = 'P0001';
  end if;

  v_has_metadata := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_sessions' and column_name = 'metadata'
  );

  v_round_id := p_metadata ->> 'roundId';
  v_player_id := p_metadata ->> 'playerId';

  if v_has_metadata and v_round_id is not null and v_player_id is not null then
    if exists (
      select 1
      from public.game_sessions gs
      where gs.game_id = p_game_id
        and gs.metadata @> jsonb_build_object('roundId', v_round_id, 'playerId', v_player_id)
    ) then
      return json_build_object('ok', true, 'skipped', true, 'unlocked_achievements', '[]'::json);
    end if;
  end if;

  if v_has_metadata then
    insert into public.game_sessions (
      game_id,
      user_id,
      duration_seconds,
      score,
      ended_at,
      metadata
    )
    values (
      p_game_id,
      p_user_id,
      greatest(coalesce(p_duration_seconds, 0), 0),
      greatest(coalesce(p_score, 0), 0),
      now(),
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_session_id;
  else
    insert into public.game_sessions (
      game_id,
      user_id,
      duration_seconds,
      score,
      ended_at
    )
    values (
      p_game_id,
      p_user_id,
      greatest(coalesce(p_duration_seconds, 0), 0),
      greatest(coalesce(p_score, 0), 0),
      now()
    )
    returning id into v_session_id;
  end if;

  if p_user_id is not null then
    v_unlocked := public.evaluate_platform_achievements(p_user_id);
  end if;

  return json_build_object(
    'ok', true,
    'session_id', v_session_id,
    'unlocked_achievements', v_unlocked
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_user_stats: extended platform stats + streak
-- ---------------------------------------------------------------------------

create or replace function public.get_user_stats(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_games int := 0;
  v_time bigint := 0;
  v_score bigint := 0;
  v_best int := 0;
  v_rooms_created bigint := 0;
  v_rooms_joined bigint := 0;
  v_achievements int := 0;
  v_last_played timestamptz;
  v_current_streak int := 0;
  v_longest_streak int := 0;
  v_member_since timestamptz;
  v_has_row boolean := false;
begin
  if p_user_id is null then
    return json_build_object(
      'user_id', null,
      'total_games_played', 0,
      'total_play_time_seconds', 0,
      'total_score', 0,
      'highest_score', 0,
      'rooms_created', 0,
      'rooms_joined', 0,
      'achievements_unlocked', 0,
      'last_played_at', null,
      'current_streak', 0,
      'longest_streak', 0,
      'member_since', null
    );
  end if;

  select
    true,
    coalesce(us.total_games_played, 0),
    coalesce(us.total_play_time_seconds, 0)::bigint,
    coalesce(us.total_score, 0)::bigint,
    coalesce(us.highest_score, 0)::integer,
    coalesce(us.rooms_created, 0)::bigint,
    coalesce(us.rooms_joined, 0)::bigint,
    coalesce(us.achievements_unlocked, 0)::integer,
    us.last_played_at
  into
    v_has_row,
    v_games,
    v_time,
    v_score,
    v_best,
    v_rooms_created,
    v_rooms_joined,
    v_achievements,
    v_last_played
  from public.user_stats us
  where us.user_id = p_user_id;

  if not v_has_row then
    select
      count(*)::integer,
      coalesce(sum(gs.duration_seconds), 0)::bigint,
      coalesce(sum(gs.score), 0)::bigint,
      coalesce(max(gs.score), 0)::integer
    into v_games, v_time, v_score, v_best
    from public.game_sessions gs
    where gs.user_id = p_user_id;
  end if;

  select
    coalesce(p.current_streak, 0),
    coalesce(p.longest_streak, 0),
    p.created_at
  into v_current_streak, v_longest_streak, v_member_since
  from public.profiles p
  where p.id = p_user_id;

  if v_achievements = 0 then
    select count(*)::integer
    into v_achievements
    from public.user_achievements ua
    where ua.user_id = p_user_id;
  end if;

  return json_build_object(
    'user_id', p_user_id,
    'total_games_played', coalesce(v_games, 0),
    'total_play_time_seconds', coalesce(v_time, 0),
    'total_score', coalesce(v_score, 0),
    'highest_score', coalesce(v_best, 0),
    'rooms_created', coalesce(v_rooms_created, 0),
    'rooms_joined', coalesce(v_rooms_joined, 0),
    'achievements_unlocked', coalesce(v_achievements, 0),
    'last_played_at', v_last_played,
    'current_streak', coalesce(v_current_streak, 0),
    'longest_streak', coalesce(v_longest_streak, 0),
    'member_since', v_member_since
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Room counters
-- ---------------------------------------------------------------------------

create or replace function public.bump_user_stat_counter(
  p_user_id uuid,
  p_column text,
  p_delta bigint default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_delta = 0 then
    return;
  end if;

  if p_column not in ('rooms_created', 'rooms_joined') then
    raise exception 'invalid_counter_column' using errcode = 'P0001';
  end if;

  insert into public.user_stats (user_id, updated_at)
  values (p_user_id, now())
  on conflict (user_id) do update set updated_at = now();

  if p_column = 'rooms_created' then
    update public.user_stats
    set rooms_created = coalesce(rooms_created, 0) + p_delta, updated_at = now()
    where user_id = p_user_id;
  else
    update public.user_stats
    set rooms_joined = coalesce(rooms_joined, 0) + p_delta, updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.create_game_room(
  p_game_slug text,
  p_code text,
  p_guest_name text default 'Convidado',
  p_max_players int default 2
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_player_id uuid;
  v_multiplayer boolean;
  v_guest text;
  v_status text := 'waiting';
  v_cols text := 'code, game_id';
  v_vals text;
  v_pcols text;
  v_pvals text;
begin
  select g.id, coalesce(g.is_multiplayer, false)
  into v_game_id, v_multiplayer
  from public.games g
  where g.slug = p_game_slug
    and g.status::text in ('active', 'published');

  if v_game_id is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if not v_multiplayer then
    raise exception 'not_multiplayer' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'room_status' and e.enumlabel = 'waiting'
  ) then
    v_status := 'lobby';
  end if;

  v_vals := format('%L, %L', p_code, v_game_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_user_id'
  ) then
    v_cols := v_cols || ', host_user_id';
    v_vals := v_vals || format(', %L', v_user_id);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_id'
  ) then
    v_cols := v_cols || ', host_id';
    v_vals := v_vals || format(', %L', v_user_id);
  end if;

  v_cols := v_cols || ', status';
  v_vals := v_vals || format(', %L', v_status);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    v_cols := v_cols || ', max_players';
    v_vals := v_vals || format(', %s', p_max_players);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  ) then
    v_cols := v_cols || ', metadata';
    v_vals := v_vals || ', ''{}''::jsonb';
  end if;

  execute format(
    'insert into public.rooms (%s) values (%s) returning id',
    v_cols,
    v_vals
  )
  into v_room_id;

  v_pcols := 'room_id';
  v_pvals := format('%L', v_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || format(
      ', %L',
      case when v_user_id is null then v_guest else null end
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', true';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format(
    'insert into public.room_players (%s) values (%s) returning id',
    v_pcols,
    v_pvals
  )
  into v_player_id;

  if v_user_id is not null then
    perform public.bump_user_stat_counter(v_user_id, 'rooms_created', 1);
  end if;

  return json_build_object(
    'room_id', v_room_id,
    'code', p_code,
    'player_id', v_player_id,
    'game_id', v_game_id
  );
end;
$$;

create or replace function public.join_game_room(
  p_room_id uuid,
  p_guest_name text default 'Convidado',
  p_player_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_guest text;
  v_count int;
  v_max int := 2;
  v_pcols text;
  v_pvals text;
  v_joined_new boolean := false;
begin
  if p_room_id is null then
    raise exception 'room_required' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if p_player_id is not null then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.id = p_player_id
      and rp.room_id = p_room_id;

    if v_player_id is not null then
      if v_user_id is null and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
      ) then
        update public.room_players
        set guest_name = v_guest
        where id = v_player_id;
      end if;

      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  if v_user_id is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id = v_user_id;

    if v_player_id is not null then
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  if v_user_id is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id is null
      and rp.guest_name = v_guest;

    if v_player_id is not null then
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  select count(*)::int
  into v_count
  from public.room_players
  where room_id = p_room_id;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    execute 'select max_players from public.rooms where id = $1'
    into v_max
    using p_room_id;
  end if;

  if v_count >= coalesce(v_max, 2) then
    raise exception 'room_full' using errcode = 'P0001';
  end if;

  v_pcols := 'room_id';
  v_pvals := format('%L', p_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || format(
      ', %L',
      case when v_user_id is null then v_guest else null end
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', false';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format(
    'insert into public.room_players (%s) values (%s) returning id',
    v_pcols,
    v_pvals
  )
  into v_player_id;

  v_joined_new := true;

  if v_joined_new and v_user_id is not null then
    perform public.bump_user_stat_counter(v_user_id, 'rooms_joined', 1);
  end if;

  return json_build_object('player_id', v_player_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed platform achievements (idempotent)
-- ---------------------------------------------------------------------------

insert into public.achievements (
  code,
  slug,
  name,
  description,
  icon,
  icon_url,
  category,
  metric,
  target_value,
  points,
  hidden
)
values
  ('FIRST_GAME', 'first_game', 'Primeiro jogo', 'Completa a tua primeira sessão na plataforma.', 'trophy', 'trophy', 'platform', 'games_played', 1, 10, false),
  ('PLAYER_10', 'player_10', '10 jogos', 'Joga 10 sessões na plataforma.', 'star', 'star', 'platform', 'games_played', 10, 20, false),
  ('PLAYER_100', 'player_100', '100 jogos', 'Joga 100 sessões na plataforma.', 'medal', 'medal', 'platform', 'games_played', 100, 50, false),
  ('PLAYER_500', 'player_500', '500 jogos', 'Joga 500 sessões na plataforma.', 'medal', 'medal', 'platform', 'games_played', 500, 100, false),
  ('PLAYER_1000', 'player_1000', '1000 jogos', 'Joga 1000 sessões na plataforma.', 'trophy', 'trophy', 'platform', 'games_played', 1000, 200, false),
  ('ONE_HOUR', 'one_hour', '1 hora', 'Acumula 1 hora de tempo de jogo.', 'clock', 'clock', 'platform', 'total_play_time_seconds', 3600, 15, false),
  ('TEN_HOURS', 'ten_hours', '10 horas', 'Acumula 10 horas de tempo de jogo.', 'clock', 'clock', 'platform', 'total_play_time_seconds', 36000, 40, false),
  ('FIFTY_HOURS', 'fifty_hours', '50 horas', 'Acumula 50 horas de tempo de jogo.', 'clock', 'clock', 'platform', 'total_play_time_seconds', 180000, 80, false),
  ('HUNDRED_HOURS', 'hundred_hours', '100 horas', 'Acumula 100 horas de tempo de jogo.', 'clock', 'clock', 'platform', 'total_play_time_seconds', 360000, 150, false),
  ('TOTAL_SCORE_1000', 'total_score_1000', '1000 pontos', 'Acumula 1000 pontos no total.', 'star', 'star', 'platform', 'total_score', 1000, 15, false),
  ('TOTAL_SCORE_10000', 'total_score_10000', '10 000 pontos', 'Acumula 10 000 pontos no total.', 'star', 'star', 'platform', 'total_score', 10000, 40, false),
  ('TOTAL_SCORE_100000', 'total_score_100000', '100 000 pontos', 'Acumula 100 000 pontos no total.', 'star', 'star', 'platform', 'total_score', 100000, 80, false),
  ('TOTAL_SCORE_1000000', 'total_score_1000000', '1 000 000 pontos', 'Acumula 1 000 000 pontos no total.', 'trophy', 'trophy', 'platform', 'total_score', 1000000, 200, false),
  ('STREAK_7', 'streak_7', '7 dias seguidos', 'Joga 7 dias consecutivos.', 'flame', 'flame', 'platform', 'current_streak', 7, 30, false),
  ('STREAK_30', 'streak_30', '30 dias seguidos', 'Joga 30 dias consecutivos.', 'flame', 'flame', 'platform', 'current_streak', 30, 80, false),
  ('STREAK_100', 'streak_100', '100 dias seguidos', 'Joga 100 dias consecutivos.', 'flame', 'flame', 'platform', 'current_streak', 100, 200, false)
on conflict (code) where code is not null do update
set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  icon_url = excluded.icon_url,
  category = excluded.category,
  metric = excluded.metric,
  target_value = excluded.target_value,
  points = excluded.points,
  hidden = excluded.hidden;

-- Backfill achievements_unlocked cache
update public.user_stats us
set achievements_unlocked = sub.cnt
from (
  select ua.user_id, count(*)::integer as cnt
  from public.user_achievements ua
  group by ua.user_id
) sub
where us.user_id = sub.user_id;

revoke all on function public.update_user_streak(uuid) from public;
grant execute on function public.update_user_streak(uuid) to anon, authenticated;

revoke all on function public.grant_user_achievement(uuid, uuid) from public;
grant execute on function public.grant_user_achievement(uuid, uuid) to anon, authenticated;

revoke all on function public.evaluate_platform_achievements(uuid) from public;
grant execute on function public.evaluate_platform_achievements(uuid) to anon, authenticated;

revoke all on function public.upsert_leaderboard_best_score(uuid, uuid, integer) from public;
grant execute on function public.upsert_leaderboard_best_score(uuid, uuid, integer) to anon, authenticated;

revoke all on function public.bump_user_stat_counter(uuid, text, bigint) from public;
grant execute on function public.bump_user_stat_counter(uuid, text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
