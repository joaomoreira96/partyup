-- Política admin completa em game_categories (insert/delete/select para verificação)

drop policy if exists "game_categories_admin_all" on public.game_categories;

create policy "game_categories_admin_all"
  on public.game_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
