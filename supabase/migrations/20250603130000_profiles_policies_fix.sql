-- Perfis: colunas em falta (Doc 03) + políticas RLS fiáveis
-- Seguro em bases só com schema inicial (sem deleted_at)

alter table public.profiles
  add column if not exists bio text,
  add column if not exists country text,
  add column if not exists deleted_at timestamptz;

drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

-- Perfis públicos (não apagados)
create policy "profiles_select_public"
  on public.profiles for select
  using (deleted_at is null);

-- O utilizador autenticado vê sempre o próprio perfil
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_stats: criar linha quando o perfil é criado no cliente
drop policy if exists "user_stats_insert_own" on public.user_stats;

create policy "user_stats_insert_own"
  on public.user_stats for insert
  to authenticated
  with check (auth.uid() = user_id);
