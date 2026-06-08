-- Fix: grant_user_achievement (alias code no SELECT INTO) + avaliação resiliente

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
  v_has_total_games boolean;
begin
  if p_user_id is null then
    return '[]'::json;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_stats'
      and column_name = 'total_games_played'
  ) into v_has_total_games;

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
    where coalesce(a.category, 'platform') = 'platform'
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
      if v_has_total_games then
        execute
          'select coalesce(us.total_games_played, 0)::bigint from public.user_stats us where us.user_id = $1'
          into v_metric_value
          using p_user_id;
      end if;

      if v_metric_value <= 0 then
        select count(*)::bigint
        into v_metric_value
        from public.game_sessions gs
        where gs.user_id = p_user_id;
      end if;
    elsif rec.metric = 'total_play_time_seconds' then
      select coalesce(us.total_play_time_seconds, 0)::bigint
      into v_metric_value
      from public.user_stats us
      where us.user_id = p_user_id;

      if v_metric_value <= 0 then
        select coalesce(sum(gs.duration_seconds), 0)::bigint
        into v_metric_value
        from public.game_sessions gs
        where gs.user_id = p_user_id;
      end if;
    elsif rec.metric = 'total_score' then
      select coalesce(us.total_score, 0)::bigint
      into v_metric_value
      from public.user_stats us
      where us.user_id = p_user_id;

      if v_metric_value <= 0 then
        select coalesce(sum(gs.score), 0)::bigint
        into v_metric_value
        from public.game_sessions gs
        where gs.user_id = p_user_id;
      end if;
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

-- Re-aplica record_game_session com unlocked_achievements na resposta
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

revoke all on function public.grant_user_achievement(uuid, uuid) from public;
grant execute on function public.grant_user_achievement(uuid, uuid) to anon, authenticated;

revoke all on function public.evaluate_platform_achievements(uuid) from public;
grant execute on function public.evaluate_platform_achievements(uuid) to anon, authenticated;

revoke all on function public.record_game_session(uuid, uuid, integer, integer, jsonb) from public;
grant execute on function public.record_game_session(uuid, uuid, integer, integer, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
