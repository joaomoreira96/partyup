-- Quick Reaction usa pontos (maior = melhor), como reaction-duel — nao tempo em ms.

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
      best_score = greatest(user_game_stats.best_score, v_sc::integer),
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

notify pgrst, 'reload schema';
