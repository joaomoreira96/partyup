-- Resolve UUID de jogo por slug (security definer), independente de RLS no cliente.
-- Compatível com schema hosted (sem coluna deleted_at).

create or replace function public.resolve_game_id(p_slug text)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'deleted_at'
  ) then
    execute
      'select id from public.games where slug = $1 and deleted_at is null limit 1'
    into v_id
    using p_slug;
  else
    select g.id
    into v_id
    from public.games g
    where g.slug = p_slug
    limit 1;
  end if;

  return v_id;
end;
$$;

revoke all on function public.resolve_game_id(text) from public;
grant execute on function public.resolve_game_id(text) to anon, authenticated;

-- Corrige list_game_catalog_slugs se a migração anterior falhou no schema hosted
create or replace function public.list_game_catalog_slugs()
returns table (slug text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'deleted_at'
  ) then
    return query execute
      'select g.slug from public.games g where g.deleted_at is null';
  else
    return query
      select g.slug from public.games g;
  end if;
end;
$$;

revoke all on function public.list_game_catalog_slugs() from public;
grant execute on function public.list_game_catalog_slugs() to anon, authenticated;

notify pgrst, 'reload schema';
