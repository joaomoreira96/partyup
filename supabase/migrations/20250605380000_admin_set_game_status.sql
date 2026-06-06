-- Ativar/desativar jogos no painel admin (security definer)

create or replace function public.admin_set_game_status(
  p_game_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('active', 'disabled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.games
  set
    status = p_status::public.game_status,
    featured = case when p_status = 'disabled' then false else featured end
  where id = p_game_id;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_game_status(uuid, text) from public;
grant execute on function public.admin_set_game_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
