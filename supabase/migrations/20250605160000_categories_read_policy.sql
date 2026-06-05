-- Leitura de categorias (RLS) + listagem admin via security definer

alter table public.categories enable row level security;

drop policy if exists "Categories are public" on public.categories;
drop policy if exists "categories_public_read" on public.categories;

create policy "categories_public_read"
  on public.categories for select
  using (true);

create or replace function public.admin_list_categories()
returns table (
  id uuid,
  slug text,
  name text
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
  select c.id, c.slug, c.name
  from public.categories c
  order by c.name;
end;
$$;

revoke all on function public.admin_list_categories() from public;
grant execute on function public.admin_list_categories() to authenticated;

notify pgrst, 'reload schema';
