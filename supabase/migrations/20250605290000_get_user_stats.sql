-- Ler user_stats via security definer (RLS hosted pode bloquear select directo no servidor)

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
  v_has_row boolean := false;
begin
  if p_user_id is null then
    return json_build_object(
      'user_id', null,
      'total_games_played', 0,
      'total_play_time_seconds', 0,
      'total_score', 0,
      'highest_score', 0
    );
  end if;

  select
    true,
    coalesce(us.total_games_played, 0),
    coalesce(us.total_play_time_seconds, 0)::bigint,
    coalesce(us.total_score, 0)::bigint,
    coalesce(us.highest_score, 0)::integer
  into v_has_row, v_games, v_time, v_score, v_best
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

  return json_build_object(
    'user_id', p_user_id,
    'total_games_played', coalesce(v_games, 0),
    'total_play_time_seconds', coalesce(v_time, 0),
    'total_score', coalesce(v_score, 0),
    'highest_score', coalesce(v_best, 0)
  );
end;
$$;

revoke all on function public.get_user_stats(uuid) from public;
grant execute on function public.get_user_stats(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
