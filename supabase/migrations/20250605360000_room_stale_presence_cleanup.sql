-- Remove presenças fantasma em salas + garante contador admin correto

create or replace function public.cleanup_stale_room_presence(
  p_max_idle_minutes int default 10
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.room_players rp
  where coalesce(rp.updated_at, rp.joined_at, now())
    < now() - make_interval(mins => greatest(p_max_idle_minutes, 1));

  get diagnostics v_deleted = row_count;

  delete from public.rooms r
  where not exists (
    select 1 from public.room_players rp where rp.room_id = r.id
  );

  return v_deleted;
end;
$$;

-- Reset de salas de teste (presenças fantasma de sessões sem leave)
delete from public.room_players;
delete from public.rooms;

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
  where r.status::text not in ('finished');
$$;

revoke all on function public.cleanup_stale_room_presence(int) from public;
revoke all on function public.count_occupied_rooms() from public;

grant execute on function public.cleanup_stale_room_presence(int) to authenticated, anon;
grant execute on function public.count_occupied_rooms() to authenticated, anon;

notify pgrst, 'reload schema';
