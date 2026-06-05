-- Categorias e atribuição a jogos via funções security definer (evita falhas de RLS)

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  return v_role = 'admin';
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Retorna uuid (formato mais fiável com PostgREST / supabase-js)
drop function if exists public.admin_create_category(text, text);

create or replace function public.admin_create_category(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
  v_id uuid;
begin
  select p.role into caller_role
  from public.profiles p
  where p.id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if trim(p_name) = '' then
    raise exception 'name_required' using errcode = 'P0001';
  end if;

  if trim(p_slug) = '' then
    raise exception 'slug_required' using errcode = 'P0001';
  end if;

  begin
    insert into public.categories (name, slug)
    values (trim(p_name), trim(p_slug))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'slug_taken' using errcode = '23505';
  end;

  return v_id;
end;
$$;

create or replace function public.admin_update_category(
  p_id uuid,
  p_name text default null,
  p_slug text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.categories
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    slug = coalesce(nullif(trim(p_slug), ''), slug)
  where id = p_id;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

create or replace function public.admin_delete_category(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_deleted int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.categories where id = p_id;
  get diagnostics rows_deleted = row_count;
  return rows_deleted > 0;
end;
$$;

create or replace function public.admin_set_game_categories(
  p_game_id uuid,
  p_category_ids uuid[]
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

  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  delete from public.game_categories where game_id = p_game_id;

  if p_category_ids is not null and array_length(p_category_ids, 1) > 0 then
    insert into public.game_categories (game_id, category_id)
    select distinct p_game_id, category_id
    from unnest(p_category_ids) as category_id;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_create_category(text, text) from public;
revoke all on function public.admin_update_category(uuid, text, text) from public;
revoke all on function public.admin_delete_category(uuid) from public;
revoke all on function public.admin_set_game_categories(uuid, uuid[]) from public;

grant execute on function public.admin_create_category(text, text) to authenticated;
grant execute on function public.admin_update_category(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_category(uuid) to authenticated;
grant execute on function public.admin_set_game_categories(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
