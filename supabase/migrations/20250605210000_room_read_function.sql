-- Ler salas via security definer (RLS + schema hosted)

create or replace function public.get_room_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_room_id uuid;
  v_room_code text;
  v_game_id uuid;
  v_status text;
  v_host uuid;
  v_max int;
  v_metadata jsonb;
begin
  v_code := upper(trim(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')));

  if v_code = '' then
    return null;
  end if;

  select r.id, r.code, r.game_id, r.status::text
  into v_room_id, v_room_code, v_game_id, v_status
  from public.rooms r
  where upper(r.code) = v_code
  limit 1;

  if v_room_id is null then
    return null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_user_id'
  ) then
    execute 'select host_user_id from public.rooms where id = $1'
    into v_host using v_room_id;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_id'
  ) then
    execute 'select host_id from public.rooms where id = $1'
    into v_host using v_room_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    execute 'select max_players from public.rooms where id = $1'
    into v_max using v_room_id;
  else
    v_max := 2;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  ) then
    execute 'select metadata from public.rooms where id = $1'
    into v_metadata using v_room_id;
  else
    v_metadata := '{}'::jsonb;
  end if;

  return json_build_object(
    'id', v_room_id,
    'code', v_room_code,
    'game_id', v_game_id,
    'status', v_status,
    'host_user_id', v_host,
    'max_players', v_max,
    'metadata', coalesce(v_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_room_by_code(text) from public;
grant execute on function public.get_room_by_code(text) to anon, authenticated;

-- Política de leitura compatível com schema hosted (deleted_at opcional)
drop policy if exists "Rooms are viewable by everyone" on public.rooms;
drop policy if exists "rooms_select_active" on public.rooms;
drop policy if exists "rooms_select_public" on public.rooms;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rooms'
      and column_name = 'deleted_at'
  ) then
    execute $policy$
      create policy "rooms_select_active"
        on public.rooms for select
        using (deleted_at is null)
    $policy$;
  else
    execute $policy$
      create policy "rooms_select_public"
        on public.rooms for select
        using (true)
    $policy$;
  end if;
end $$;

notify pgrst, 'reload schema';
