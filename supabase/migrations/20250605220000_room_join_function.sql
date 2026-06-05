-- Entrar em salas + listar jogadores via security definer (RLS + schema hosted)

create or replace function public.join_game_room(
  p_room_id uuid,
  p_guest_name text default 'Convidado',
  p_player_id uuid default null
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
  v_count int;
  v_max int := 2;
  v_pcols text;
  v_pvals text;
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

    if v_player_id is not null then
      if v_user_id is null and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
      ) then
        update public.room_players
        set guest_name = v_guest
        where id = v_player_id;
      end if;

      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  if v_user_id is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id = v_user_id;

    if v_player_id is not null then
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  if v_user_id is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    select rp.id
    into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id is null
      and rp.guest_name = v_guest;

    if v_player_id is not null then
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  select count(*)::int
  into v_count
  from public.room_players
  where room_id = p_room_id;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    execute 'select max_players from public.rooms where id = $1'
    into v_max
    using p_room_id;
  end if;

  if v_count >= coalesce(v_max, 2) then
    raise exception 'room_full' using errcode = 'P0001';
  end if;

  v_pcols := 'room_id';
  v_pvals := format('%L', p_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || format(
      ', %L',
      case when v_user_id is null then v_guest else null end
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', false';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format(
    'insert into public.room_players (%s) values (%s) returning id',
    v_pcols,
    v_pvals
  )
  into v_player_id;

  return json_build_object('player_id', v_player_id);
end;
$$;

create or replace function public.list_room_players(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if p_room_id is null then
    return '[]'::json;
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', rp.id,
        'room_id', rp.room_id,
        'user_id', rp.user_id,
        'guest_name', rp.guest_name,
        'is_ready', coalesce(rp.is_ready, false),
        'is_host', coalesce(rp.is_host, false),
        'joined_at', coalesce(rp.joined_at, rp.created_at, now())
      )
      order by coalesce(rp.joined_at, rp.created_at, now())
    ),
    '[]'::json
  )
  into v_result
  from public.room_players rp
  where rp.room_id = p_room_id;

  return v_result;
exception
  when undefined_column then
    select coalesce(
      json_agg(
        json_build_object(
          'id', rp.id,
          'room_id', rp.room_id,
          'user_id', rp.user_id,
          'guest_name', rp.guest_name
        )
      ),
      '[]'::json
    )
    into v_result
    from public.room_players rp
    where rp.room_id = p_room_id;

    return coalesce(v_result, '[]'::json);
end;
$$;

revoke all on function public.join_game_room(uuid, text, uuid) from public;
grant execute on function public.join_game_room(uuid, text, uuid) to anon, authenticated;

revoke all on function public.list_room_players(uuid) from public;
grant execute on function public.list_room_players(uuid) to anon, authenticated;

-- Garantir leitura/inserção em room_players para convidados
drop policy if exists "Room players are viewable" on public.room_players;
drop policy if exists "Anyone can join as guest or user" on public.room_players;
drop policy if exists "room_players_select" on public.room_players;
drop policy if exists "room_players_insert" on public.room_players;

create policy "room_players_select"
  on public.room_players for select using (true);

create policy "room_players_insert"
  on public.room_players for insert with check (true);

notify pgrst, 'reload schema';
