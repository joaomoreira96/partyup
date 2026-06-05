-- Reaction Duel — multiplayer de referência

alter table public.rooms
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Realtime na tabela rooms (sincronização de fases)
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end $$;

-- Jogo Reaction Duel (schema hosted)
update public.games
set
  name = 'Reaction Duel',
  description = 'Duelo de reflexos 1v1. Espera pelo verde e clica mais rápido que o teu adversário.',
  thumbnail_url = '/games/reaction-duel-thumb.svg',
  banner_url = '/games/reaction-duel-banner.svg',
  category = 'party',
  is_multiplayer = true,
  supports_mobile = true,
  supports_desktop = true,
  status = 'active'
where slug = 'reaction-duel';

insert into public.games (
  slug,
  name,
  description,
  thumbnail_url,
  banner_url,
  category,
  is_multiplayer,
  supports_mobile,
  supports_desktop,
  status
)
select
  'reaction-duel',
  'Reaction Duel',
  'Duelo de reflexos 1v1. Espera pelo verde e clica mais rápido que o teu adversário.',
  '/games/reaction-duel-thumb.svg',
  '/games/reaction-duel-banner.svg',
  'party',
  true,
  true,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'reaction-duel'
);

insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on c.slug in ('party', 'arcade')
where g.slug = 'reaction-duel'
  and not exists (
    select 1 from public.game_categories gc
    where gc.game_id = g.id and gc.category_id = c.id
  );

insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', 'reaction-duel', true
from public.games g
where g.slug = 'reaction-duel'
  and not exists (
    select 1 from public.game_builds b
    where b.game_id = g.id and b.version = '1.0.0'
  );

insert into public.game_stats (game_id)
select g.id from public.games g
where g.slug = 'reaction-duel'
  and not exists (
    select 1 from public.game_stats s where s.game_id = g.id
  );

-- Permitir convidados marcarem ready (update por guest_name via API)
drop policy if exists "room_players_update_guest" on public.room_players;

create policy "room_players_delete_own"
  on public.room_players for delete
  using (true);

notify pgrst, 'reload schema';
