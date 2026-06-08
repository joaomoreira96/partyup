-- Garante trigger apply_session_stats com user_game_stats + backfill histórico

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

drop trigger if exists on_game_session_finished on public.game_sessions;
create trigger on_game_session_finished
  after insert on public.game_sessions
  for each row execute function public.apply_session_stats();

-- Backfill user_game_stats a partir de game_sessions existentes
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
select
  gs.user_id,
  gs.game_id,
  case
    when coalesce(g.module_id, '') = 'reaction' then
      coalesce(
        min(gs.score) filter (where gs.score > 0),
        0
      )::integer
    else
      coalesce(max(gs.score), 0)::integer
  end,
  count(*)::integer,
  coalesce(sum(coalesce(gs.duration_seconds, 0)), 0)::bigint,
  min(coalesce(gs.ended_at, gs.created_at)),
  max(coalesce(gs.ended_at, gs.created_at)),
  now()
from public.game_sessions gs
left join public.games g on g.id = gs.game_id
where gs.user_id is not null
group by gs.user_id, gs.game_id, g.module_id
on conflict (user_id, game_id) do update
set
  best_score = excluded.best_score,
  sessions_played = excluded.sessions_played,
  play_time_seconds = excluded.play_time_seconds,
  first_played_at = excluded.first_played_at,
  last_played_at = excluded.last_played_at,
  updated_at = now();

notify pgrst, 'reload schema';
