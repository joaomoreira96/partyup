-- Iframe V2: leitura pública de builds activos
--
-- O GameRunner precisa de game_builds.build_url para jogos runtime=iframe.
-- Builds activos apontam para URLs públicas no bucket game-builds.

alter table public.game_builds
  add column if not exists deleted_at timestamptz;

drop policy if exists "game_builds_select_active" on public.game_builds;
drop policy if exists "game_builds_select_public" on public.game_builds;

create policy "game_builds_select_public"
  on public.game_builds for select
  using (
    is_active = true
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
