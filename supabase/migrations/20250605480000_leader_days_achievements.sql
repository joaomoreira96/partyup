-- Conquista "rei da colina": dias em 1º lugar nos pontos da plataforma (1/10/50/100).
-- Mantemos um registo por dia com o líder (maior total_score) e contamos os dias por user.

-- ---------------------------------------------------------------------------
-- Tabela: líder de cada dia
-- ---------------------------------------------------------------------------
create table if not exists public.platform_leader_days (
  day date primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_score bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_leader_days enable row level security;

drop policy if exists "platform_leader_days_select" on public.platform_leader_days;
create policy "platform_leader_days_select"
  on public.platform_leader_days for select using (true);

-- ---------------------------------------------------------------------------
-- Função: regista (upsert) o líder do dia indicado
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_platform_leader_day(p_day date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_score bigint;
begin
  select us.user_id, coalesce(us.total_score, 0)::bigint
  into v_user_id, v_score
  from public.user_stats us
  join public.profiles p on p.id = us.user_id
  where coalesce(us.total_score, 0) > 0
    and coalesce(p.is_banned, false) = false
    and p.deleted_at is null
  order by us.total_score desc
  limit 1;

  if v_user_id is null then
    return;
  end if;

  insert into public.platform_leader_days (day, user_id, total_score, updated_at)
  values (p_day, v_user_id, v_score, now())
  on conflict (day) do update
  set user_id = excluded.user_id,
      total_score = excluded.total_score,
      updated_at = now();
end;
$$;

revoke all on function public.evaluate_platform_leader_day(date) from public;
grant execute on function public.evaluate_platform_leader_day(date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- evaluate_platform_achievements: adiciona a métrica 'leader_days'
-- ---------------------------------------------------------------------------
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
    elsif rec.metric = 'leader_days' then
      select count(*)::bigint
      into v_metric_value
      from public.platform_leader_days pld
      where pld.user_id = p_user_id;
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

-- ---------------------------------------------------------------------------
-- record_game_session: regista o líder do dia antes de avaliar conquistas
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
    begin
      perform public.evaluate_platform_leader_day();
    exception
      when others then
        raise warning 'record_game_session: evaluate_platform_leader_day failed: %', sqlerrm;
    end;

    v_unlocked := public.evaluate_platform_achievements(p_user_id);
  end if;

  return json_build_object(
    'ok', true,
    'session_id', v_session_id,
    'unlocked_achievements', v_unlocked
  );
end;
$$;

revoke all on function public.record_game_session(uuid, uuid, integer, integer, jsonb) from public;
grant execute on function public.record_game_session(uuid, uuid, integer, integer, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: conquistas leader_days
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
  ('LEADER_DAYS_1', 'leader_days_1', 'Rei por um dia', 'Termina um dia em 1º lugar nos pontos da plataforma.', 'crown', 'crown', 'platform', 'leader_days', 1, 25, false),
  ('LEADER_DAYS_10', 'leader_days_10', 'Soberano', 'Passa 10 dias em 1º lugar nos pontos da plataforma.', 'crown', 'crown', 'platform', 'leader_days', 10, 60, false),
  ('LEADER_DAYS_50', 'leader_days_50', 'Dinastia', 'Passa 50 dias em 1º lugar nos pontos da plataforma.', 'crown', 'crown', 'platform', 'leader_days', 50, 150, false),
  ('LEADER_DAYS_100', 'leader_days_100', 'Lenda da plataforma', 'Passa 100 dias em 1º lugar nos pontos da plataforma.', 'crown', 'crown', 'platform', 'leader_days', 100, 300, false)
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

notify pgrst, 'reload schema';
