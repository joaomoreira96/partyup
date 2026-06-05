-- Snake — primeiro jogo oficial (schema hosted sem module_id / sem unique em slug)
-- O module_id fica em game_builds.build_url = 'snake'
-- Idempotente sem ON CONFLICT (BD hosted pode não ter as mesmas constraints)

update public.games
set
  name = 'Snake',
  description = 'Controla a cobra, recolhe comida e tenta obter a maior pontuação possível.',
  thumbnail_url = '/games/snake-thumb.svg',
  banner_url = '/games/snake-banner.svg',
  category = 'arcade',
  is_multiplayer = false,
  supports_mobile = true,
  supports_desktop = true,
  status = 'active'
where slug = 'snake';

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
  'snake',
  'Snake',
  'Controla a cobra, recolhe comida e tenta obter a maior pontuação possível.',
  '/games/snake-thumb.svg',
  '/games/snake-banner.svg',
  'arcade',
  false,
  true,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'snake'
);

insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on c.slug = 'arcade'
where g.slug = 'snake'
  and not exists (
    select 1
    from public.game_categories gc
    where gc.game_id = g.id
      and gc.category_id = c.id
  );

update public.game_builds b
set
  build_url = 'snake',
  is_active = true
from public.games g
where b.game_id = g.id
  and g.slug = 'snake'
  and b.version = '1.0.0';

insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', 'snake', true
from public.games g
where g.slug = 'snake'
  and not exists (
    select 1
    from public.game_builds b
    where b.game_id = g.id
      and b.version = '1.0.0'
  );

insert into public.game_stats (game_id)
select g.id
from public.games g
where g.slug = 'snake'
  and not exists (
    select 1 from public.game_stats s where s.game_id = g.id
  );
