-- Não fazer rollback da conquista se o evento analytics falhar

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

revoke all on function public.grant_user_achievement(uuid, uuid) from public;
grant execute on function public.grant_user_achievement(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
