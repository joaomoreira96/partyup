-- Preferências do utilizador: tema e idioma guardados no perfil.
-- Nullable de propósito: só se aplica quando o user define explicitamente,
-- caso contrário mantém-se o comportamento por defeito (dark / cookie).

alter table public.profiles
  add column if not exists theme text,
  add column if not exists locale text;

-- Garante que cada utilizador pode atualizar o seu próprio perfil (idempotente).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

notify pgrst, 'reload schema';
