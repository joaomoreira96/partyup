-- list_room_players: evitar fallback sem is_ready quando joined_at/created_at faltam

alter table public.room_players
  add column if not exists joined_at timestamptz not null default now();

create or replace function public.list_room_players(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
  v_has_ready boolean;
  v_has_host boolean;
  v_has_joined boolean;
begin
  if p_room_id is null then
    return '[]'::json;
  end if;

  v_has_ready := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  );

  v_has_host := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  );

  v_has_joined := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'joined_at'
  );

  if v_has_joined then
    select coalesce(
      json_agg(
        json_build_object(
          'id', rp.id,
          'room_id', rp.room_id,
          'user_id', rp.user_id,
          'guest_name', rp.guest_name,
          'is_ready', case when v_has_ready then coalesce(rp.is_ready, false) else false end,
          'is_host', case when v_has_host then coalesce(rp.is_host, false) else false end,
          'joined_at', rp.joined_at
        )
        order by rp.joined_at, rp.id
      ),
      '[]'::json
    )
    into v_result
    from public.room_players rp
    where rp.room_id = p_room_id;
  else
    select coalesce(
      json_agg(
        json_build_object(
          'id', rp.id,
          'room_id', rp.room_id,
          'user_id', rp.user_id,
          'guest_name', rp.guest_name,
          'is_ready', case when v_has_ready then coalesce(rp.is_ready, false) else false end,
          'is_host', case when v_has_host then coalesce(rp.is_host, false) else false end,
          'joined_at', now()
        )
        order by rp.id
      ),
      '[]'::json
    )
    into v_result
    from public.room_players rp
    where rp.room_id = p_room_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.list_room_players(uuid) from public;
grant execute on function public.list_room_players(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
