-- Gestão de bans em perfis

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text;

-- Admins podem atualizar qualquer perfil (ex.: banir utilizadores)
drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
