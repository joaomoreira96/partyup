-- Ready + start: encontrar jogador na sala e atualizar sem depender de FOUND

alter table public.rooms
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.ready_room_player(
  p_room_id uuid,
  p_guest_name text default 'Convidado',
  p_player_id uuid default null,
  p_is_ready boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_guest text;
  v_sql text;
begin
  if p_room_id is null then
    raise exception 'room_required' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if p_player_id is not null then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.id = p_player_id
      and rp.room_id = p_room_id;
  end if;

  if v_player_id is null and v_user_id is not null then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id = v_user_id;
  end if;

  if v_player_id is null then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id is null
      and rp.guest_name = v_guest;
  end if;

  if v_player_id is null and v_user_id is null then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id is null
    order by rp.id
    limit 1;
  end if;

  if v_player_id is null then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    return json_build_object('ok', true, 'player_id', v_player_id, 'is_ready', p_is_ready);
  end if;

  v_sql := 'update public.room_players set is_ready = $1';

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'updated_at'
  ) then
    v_sql := v_sql || ', updated_at = now()';
  end if;

  v_sql := v_sql || ' where id = $2';

  execute v_sql using p_is_ready, v_player_id;

  return json_build_object('ok', true, 'player_id', v_player_id, 'is_ready', p_is_ready);
end;
$$;

create or replace function public.update_game_room(
  p_room_id uuid,
  p_status text default null,
  p_metadata jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_metadata boolean;
  v_has_updated_at boolean;
  v_has_status boolean;
  v_sql text;
  v_status text;
begin
  if p_room_id is null then
    raise exception 'room_required' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  v_has_metadata := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  );

  v_has_updated_at := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'updated_at'
  );

  v_has_status := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'status'
  );

  v_status := p_status;

  if v_status is not null and v_has_status then
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'room_status' and e.enumlabel = v_status
    ) then
      if v_status = 'playing' and exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'room_status' and e.enumlabel = 'lobby'
      ) then
        v_status := null;
      elsif v_status = 'waiting' and exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'room_status' and e.enumlabel = 'lobby'
      ) then
        v_status := 'lobby';
      else
        v_status := null;
      end if;
    end if;
  end if;

  if p_metadata is not null and v_has_metadata then
    v_sql := 'update public.rooms set metadata = $1';

    if v_status is not null and v_has_status then
      v_sql := v_sql || format(', status = %L', v_status);
    end if;

    if v_has_updated_at then
      v_sql := v_sql || ', updated_at = now()';
    end if;

    v_sql := v_sql || ' where id = $2';
    execute v_sql using p_metadata, p_room_id;
  elsif v_status is not null and v_has_status then
    v_sql := format('update public.rooms set status = %L', v_status);

    if v_has_updated_at then
      v_sql := v_sql || ', updated_at = now()';
    end if;

    v_sql := v_sql || format(' where id = %L', p_room_id);
    execute v_sql;
  end if;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.ready_room_player(uuid, text, uuid, boolean) from public;
grant execute on function public.ready_room_player(uuid, text, uuid, boolean) to anon, authenticated;

revoke all on function public.update_game_room(uuid, text, jsonb) from public;
grant execute on function public.update_game_room(uuid, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
