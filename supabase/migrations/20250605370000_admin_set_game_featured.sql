-- Destaques na homepage: RPC security definer (mesmo padrão das categorias)

create or replace function public.admin_set_game_featured(
  p_game_id uuid,
  p_featured boolean
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

  update public.games
  set featured = p_featured
  where id = p_game_id;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_game_featured(uuid, boolean) from public;
grant execute on function public.admin_set_game_featured(uuid, boolean) to authenticated;

drop policy if exists "games_admin_all" on public.games;

create policy "games_admin_all"
  on public.games for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
