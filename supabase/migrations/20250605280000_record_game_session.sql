-- Gravar sessões e estatísticas via RPC (security definer), independente de RLS/trigger no cliente

alter table public.game_sessions
  add column if not exists metadata jsonb default '{}'::jsonb;

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
      return json_build_object('ok', true, 'skipped', true);
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

  -- Estatísticas via trigger on_game_session_finished (apply_session_stats)
  return json_build_object('ok', true, 'session_id', v_session_id);
end;
$$;

revoke all on function public.record_game_session(uuid, uuid, integer, integer, jsonb) from public;
grant execute on function public.record_game_session(uuid, uuid, integer, integer, jsonb) to anon, authenticated;

-- Mantém trigger como rede de segurança (idempotente)
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
begin
  if new.user_id is not null then
    insert into public.user_stats (
      user_id,
      total_games_played,
      total_play_time_seconds,
      total_score,
      highest_score,
      updated_at
    )
    values (new.user_id, 1, v_dur, v_sc, v_sc::integer, now())
    on conflict (user_id) do update
    set
      total_games_played = user_stats.total_games_played + 1,
      total_play_time_seconds = user_stats.total_play_time_seconds + v_dur,
      total_score = user_stats.total_score + v_sc,
      highest_score = greatest(user_stats.highest_score, v_sc::integer),
      updated_at = now();
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

drop trigger if exists on_game_session_finished on public.game_sessions;
create trigger on_game_session_finished
  after insert on public.game_sessions
  for each row execute function public.apply_session_stats();

notify pgrst, 'reload schema';
