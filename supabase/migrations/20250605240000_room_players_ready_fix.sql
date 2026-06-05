-- Fix ready/update: colunas opcionais em room_players e rooms (schema hosted)

alter table public.room_players
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_room_player_ready(
  p_player_id uuid,
  p_is_ready boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sql text;
begin
  if p_player_id is null then
    raise exception 'player_required' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    return json_build_object('ok', true, 'is_ready', p_is_ready);
  end if;

  v_sql := 'update public.room_players set is_ready = $1';

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'updated_at'
  ) then
    v_sql := v_sql || ', updated_at = now()';
  end if;

  v_sql := v_sql || ' where id = $2';

  execute v_sql using p_is_ready, p_player_id;

  if not found then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  return json_build_object('ok', true, 'is_ready', p_is_ready);
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
  v_sql text;
begin
  if p_room_id is null then
    raise exception 'room_required' using errcode = 'P0001';
  end if;

  v_has_metadata := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  );

  v_has_updated_at := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'updated_at'
  );

  if p_metadata is not null and v_has_metadata then
    v_sql := 'update public.rooms set metadata = $1';
    if p_status is not null then
      v_sql := v_sql || format(', status = %L', p_status);
    end if;
    if v_has_updated_at then
      v_sql := v_sql || ', updated_at = now()';
    end if;
    v_sql := v_sql || ' where id = $2';
    execute v_sql using p_metadata, p_room_id;
  elsif p_status is not null then
    v_sql := format('update public.rooms set status = %L', p_status);
    if v_has_updated_at then
      v_sql := v_sql || ', updated_at = now()';
    end if;
    v_sql := v_sql || format(' where id = %L', p_room_id);
    execute v_sql;
  end if;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.set_room_player_ready(uuid, boolean) from public;
grant execute on function public.set_room_player_ready(uuid, boolean) to anon, authenticated;

revoke all on function public.update_game_room(uuid, text, jsonb) from public;
grant execute on function public.update_game_room(uuid, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
