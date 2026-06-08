-- Garante leitura do catálogo de conquistas e dos desbloqueios pelo cliente.
-- Sem estas policies de SELECT, o perfil (privado e público) não consegue ler
-- user_achievements via RLS, mesmo com as conquistas gravadas (a RPC ignora RLS).

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Achievements are public" on public.achievements;
create policy "Achievements are public"
  on public.achievements for select using (true);

drop policy if exists "User achievements viewable" on public.user_achievements;
create policy "User achievements viewable"
  on public.user_achievements for select using (true);

-- Garante que as conquistas de plataforma têm category preenchida (caso o seed
-- antigo tenha ficado com category nula numa BD que divergiu do baseline).
update public.achievements
set category = 'platform'
where category is null
  and metric is not null
  and target_value is not null;

notify pgrst, 'reload schema';
