-- Permite ao utilizador escolher que conquistas mostra no perfil público.
alter table public.user_achievements
  add column if not exists is_featured boolean not null default false;

-- O próprio utilizador pode atualizar os seus desbloqueios (destaque).
drop policy if exists "user_achievements_update_own" on public.user_achievements;
create policy "user_achievements_update_own"
  on public.user_achievements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
