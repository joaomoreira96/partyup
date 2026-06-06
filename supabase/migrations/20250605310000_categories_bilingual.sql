-- Categorias bilíngues: nome em português (name) e inglês (name_en)
-- Migração não destrutiva: preserva categorias e associações game_categories.

alter table public.categories
  add column if not exists name_en text not null default '';

-- Preencher name_en para linhas existentes (slug conhecido → tradução; senão copia name)
update public.categories
set name_en = case slug
  when 'memory' then 'Memory'
  when 'strategy' then 'Strategy'
  else name
end
where name_en = '';

alter table public.categories
  alter column name_en drop default;
-- admin_create_category: aceita nome PT e EN
drop function if exists public.admin_create_category(text, text);

create or replace function public.admin_create_category(
  p_name text,
  p_slug text,
  p_name_en text default ''
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
    insert into public.categories (name, slug, name_en)
    values (trim(p_name), trim(p_slug), coalesce(nullif(trim(p_name_en), ''), trim(p_name)))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'slug_taken' using errcode = '23505';
  end;

  return v_id;
end;
$$;

-- admin_update_category: aceita nome PT e EN
drop function if exists public.admin_update_category(uuid, text, text);

create or replace function public.admin_update_category(
  p_id uuid,
  p_name text default null,
  p_slug text default null,
  p_name_en text default null
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
    slug = coalesce(nullif(trim(p_slug), ''), slug),
    name_en = case
      when p_name_en is null then name_en
      when trim(p_name_en) = '' then name
      else trim(p_name_en)
    end
  where id = p_id;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

-- admin_list_categories: devolve name_en
drop function if exists public.admin_list_categories();

create or replace function public.admin_list_categories()
returns table (
  id uuid,
  slug text,
  name text,
  name_en text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
begin
  select p.role into caller_role
  from public.profiles p
  where p.id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select c.id, c.slug, c.name, c.name_en
  from public.categories c
  order by c.name;
end;
$$;

revoke all on function public.admin_create_category(text, text, text) from public;
revoke all on function public.admin_update_category(uuid, text, text, text) from public;
grant execute on function public.admin_create_category(text, text, text) to authenticated;
grant execute on function public.admin_update_category(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
