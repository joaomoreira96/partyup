-- Fechar/apagar salas sem jogadores + contador admin fiável

-- Apaga salas órfãs existentes (liberta códigos para reutilização)
delete from public.rooms r
where not exists (
  select 1 from public.room_players rp where rp.room_id = r.id
);

create or replace function public.cleanup_room_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_player_count int;
begin
  v_room_id := old.room_id;
  if v_room_id is null then
    return old;
  end if;

  select count(*)::int into v_player_count
  from public.room_players rp
  where rp.room_id = v_room_id;

  if v_player_count = 0 then
    delete from public.rooms where id = v_room_id;
  end if;

  return old;
end;
$$;

drop trigger if exists room_players_cleanup_empty_room on public.room_players;

create trigger room_players_cleanup_empty_room
  after delete on public.room_players
  for each row
  execute function public.cleanup_room_if_empty();

create or replace function public.count_occupied_rooms()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(distinct r.id)::bigint
  from public.rooms r
  inner join public.room_players rp on rp.room_id = r.id
  where r.status::text in ('waiting', 'playing', 'lobby');
$$;

revoke all on function public.count_occupied_rooms() from public;
grant execute on function public.count_occupied_rooms() to authenticated;

notify pgrst, 'reload schema';
