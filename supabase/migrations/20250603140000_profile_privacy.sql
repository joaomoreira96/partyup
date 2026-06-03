-- Privacidade do perfil público

alter table public.profiles
  add column if not exists public_profile boolean not null default true,
  add column if not exists show_activity boolean not null default true,
  add column if not exists show_country boolean not null default true;

-- Sessões visíveis para estatísticas de perfis públicos
drop policy if exists "game_sessions_select_public_profiles" on public.game_sessions;

create policy "game_sessions_select_public_profiles"
  on public.game_sessions for select
  using (
    user_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = game_sessions.user_id
        and coalesce(p.public_profile, true) = true
        and p.deleted_at is null
    )
  );
