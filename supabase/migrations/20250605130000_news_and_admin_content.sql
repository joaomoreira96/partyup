-- Políticas admin (categorias, jogos) + RLS para news_posts existente

-- Remover tabela experimental se tiver sido criada em dev
drop table if exists public.news;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- news_posts (tabela já existente no projeto)
alter table public.news_posts enable row level security;

drop policy if exists "news_posts_select_published" on public.news_posts;
drop policy if exists "news_posts_admin_all" on public.news_posts;

create policy "news_posts_select_published"
  on public.news_posts for select
  using (published = true);

create policy "news_posts_admin_all"
  on public.news_posts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Categories (admin write)
drop policy if exists "categories_admin_write" on public.categories;

create policy "categories_admin_insert"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

create policy "categories_admin_update"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_admin_delete"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- game_categories (admin write)
drop policy if exists "game_categories_admin_insert" on public.game_categories;
drop policy if exists "game_categories_admin_delete" on public.game_categories;

create policy "game_categories_admin_insert"
  on public.game_categories for insert
  to authenticated
  with check (public.is_admin());

create policy "game_categories_admin_delete"
  on public.game_categories for delete
  to authenticated
  using (public.is_admin());
