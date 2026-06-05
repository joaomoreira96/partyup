-- Sincronizar user_stats e game_stats a partir de game_sessions (fonte de verdade)

create or replace function public.apply_session_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dur bigint := coalesce(new.duration_seconds, 0)::bigint;
  sc bigint := coalesce(new.score, 0)::bigint;
  is_new_player boolean;
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
    values (new.user_id, 1, dur, sc, sc::integer, now())
    on conflict (user_id) do update
    set
      total_games_played = user_stats.total_games_played + 1,
      total_play_time_seconds = user_stats.total_play_time_seconds + dur,
      total_score = user_stats.total_score + sc,
      highest_score = greatest(user_stats.highest_score, sc::integer),
      updated_at = now();
  end if;

  if new.user_id is not null then
    select not exists (
      select 1
      from public.game_sessions gs
      where gs.game_id = new.game_id
        and gs.user_id = new.user_id
        and gs.id <> new.id
    ) into is_new_player;
  else
    is_new_player := false;
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
    dur,
    sc::integer,
    case when is_new_player then 1 else 0 end,
    now()
  )
  on conflict (game_id) do update
  set
    total_sessions = game_stats.total_sessions + 1,
    total_play_time_seconds = game_stats.total_play_time_seconds + dur,
    highest_score = greatest(game_stats.highest_score, sc::integer),
    total_players = game_stats.total_players + case when is_new_player then 1 else 0 end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_game_session_finished on public.game_sessions;

create trigger on_game_session_finished
  after insert on public.game_sessions
  for each row execute function public.apply_session_stats();

-- Recalcular estatísticas existentes a partir das sessões guardadas
insert into public.user_stats (
  user_id,
  total_games_played,
  total_play_time_seconds,
  total_score,
  highest_score,
  updated_at
)
select
  gs.user_id,
  count(*)::integer,
  coalesce(sum(gs.duration_seconds), 0)::bigint,
  coalesce(sum(gs.score), 0)::bigint,
  coalesce(max(gs.score), 0)::integer,
  now()
from public.game_sessions gs
where gs.user_id is not null
group by gs.user_id
on conflict (user_id) do update
set
  total_games_played = excluded.total_games_played,
  total_play_time_seconds = excluded.total_play_time_seconds,
  total_score = excluded.total_score,
  highest_score = excluded.highest_score,
  updated_at = now();

insert into public.game_stats (
  game_id,
  total_sessions,
  total_play_time_seconds,
  highest_score,
  total_players,
  updated_at
)
select
  gs.game_id,
  count(*)::integer,
  coalesce(sum(gs.duration_seconds), 0)::bigint,
  coalesce(max(gs.score), 0)::integer,
  count(distinct gs.user_id)::integer,
  now()
from public.game_sessions gs
group by gs.game_id
on conflict (game_id) do update
set
  total_sessions = excluded.total_sessions,
  total_play_time_seconds = excluded.total_play_time_seconds,
  highest_score = excluded.highest_score,
  total_players = excluded.total_players,
  updated_at = now();
