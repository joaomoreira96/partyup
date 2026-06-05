-- Criar salas via security definer (RLS + convidados + schema hosted)

create or replace function public.create_game_room(
  p_game_slug text,
  p_code text,
  p_guest_name text default 'Convidado',
  p_max_players int default 2
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_player_id uuid;
  v_multiplayer boolean;
  v_guest text;
  v_status text := 'waiting';
  v_cols text := 'code, game_id';
  v_vals text;
  v_pcols text;
  v_pvals text;
begin
  select g.id, coalesce(g.is_multiplayer, false)
  into v_game_id, v_multiplayer
  from public.games g
  where g.slug = p_game_slug
    and g.status::text in ('active', 'published');

  if v_game_id is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if not v_multiplayer then
    raise exception 'not_multiplayer' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'room_status' and e.enumlabel = 'waiting'
  ) then
    v_status := 'lobby';
  end if;

  v_vals := format('%L, %L', p_code, v_game_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_user_id'
  ) then
    v_cols := v_cols || ', host_user_id';
    v_vals := v_vals || format(', %L', v_user_id);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_id'
  ) then
    v_cols := v_cols || ', host_id';
    v_vals := v_vals || format(', %L', v_user_id);
  end if;

  v_cols := v_cols || ', status';
  v_vals := v_vals || format(', %L', v_status);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    v_cols := v_cols || ', max_players';
    v_vals := v_vals || format(', %s', p_max_players);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  ) then
    v_cols := v_cols || ', metadata';
    v_vals := v_vals || ', ''{}''::jsonb';
  end if;

  execute format(
    'insert into public.rooms (%s) values (%s) returning id',
    v_cols,
    v_vals
  )
  into v_room_id;

  v_pcols := 'room_id';
  v_pvals := format('%L', v_room_id);

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
    v_pvals := v_pvals || ', true';
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

  return json_build_object(
    'room_id', v_room_id,
    'code', p_code,
    'player_id', v_player_id,
    'game_id', v_game_id
  );
end;
$$;

revoke all on function public.create_game_room(text, text, text, int) from public;
grant execute on function public.create_game_room(text, text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
