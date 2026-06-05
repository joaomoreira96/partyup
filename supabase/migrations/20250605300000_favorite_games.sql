-- favorite_games: RLS + RPCs (leitura/toggle fiáveis no servidor hosted)

alter table public.favorite_games enable row level security;

drop policy if exists "Users read own favorites" on public.favorite_games;
create policy "Users read own favorites"
  on public.favorite_games
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own favorites" on public.favorite_games;
create policy "Users insert own favorites"
  on public.favorite_games
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own favorites" on public.favorite_games;
create policy "Users delete own favorites"
  on public.favorite_games
  for delete
  using (auth.uid() = user_id);

create or replace function public.get_user_favorite_game_ids(p_user_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if p_user_id is null then
    return array[]::uuid[];
  end if;

  select coalesce(
    array_agg(fg.game_id order by fg.created_at desc),
    array[]::uuid[]
  )
  into v_ids
  from public.favorite_games fg
  where fg.user_id = p_user_id;

  return coalesce(v_ids, array[]::uuid[]);
end;
$$;

create or replace function public.toggle_favorite_game(p_game_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean := false;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_game_id is null then
    return json_build_object('ok', false, 'error', 'invalid_game');
  end if;

  if not exists (
    select 1 from public.games g where g.id = p_game_id and g.status = 'active'
  ) then
    return json_build_object('ok', false, 'error', 'game_not_found');
  end if;

  select exists (
    select 1
    from public.favorite_games fg
    where fg.user_id = v_user_id and fg.game_id = p_game_id
  )
  into v_exists;

  if v_exists then
    delete from public.favorite_games
    where user_id = v_user_id and game_id = p_game_id;
    return json_build_object('ok', true, 'is_favorite', false);
  end if;

  insert into public.favorite_games (user_id, game_id)
  values (v_user_id, p_game_id);

  return json_build_object('ok', true, 'is_favorite', true);
end;
$$;

revoke all on function public.get_user_favorite_game_ids(uuid) from public;
grant execute on function public.get_user_favorite_game_ids(uuid) to anon, authenticated;

revoke all on function public.toggle_favorite_game(uuid) from public;
grant execute on function public.toggle_favorite_game(uuid) to authenticated;

notify pgrst, 'reload schema';
