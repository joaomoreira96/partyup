-- Sincroniza o catálogo de jogos e expõe slugs para merge com o catálogo estático da app.
-- Corrige jogos em falta ou presos em "draft" que não aparecem no separador Games.

create or replace function public.list_game_catalog_slugs()
returns table (slug text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'deleted_at'
  ) then
    return query execute
      'select g.slug from public.games g where g.deleted_at is null';
  else
    return query
      select g.slug from public.games g;
  end if;
end;
$$;

revoke all on function public.list_game_catalog_slugs() from public;
grant execute on function public.list_game_catalog_slugs() to anon, authenticated;

-- Garantir colunas usadas pelo schema hosted
alter table public.games
  add column if not exists category text,
  add column if not exists is_multiplayer boolean,
  add column if not exists name_en text;

-- Click Frenzy
update public.games
set
  name = 'Click Frenzy',
  name_en = 'Click Frenzy',
  description = 'Clica o mais rapido possivel durante 15 segundos. Vence quem fizer mais cliques. Ate 8 jogadores.',
  thumbnail_url = '/games/click-frenzy-thumb.svg',
  banner_url = '/games/click-frenzy-banner.svg',
  category = 'party',
  is_multiplayer = true,
  supports_mobile = true,
  supports_desktop = true,
  status = 'active'
where slug = 'click-frenzy';

insert into public.games (
  slug,
  name,
  name_en,
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
  'click-frenzy',
  'Click Frenzy',
  'Click Frenzy',
  'Clica o mais rapido possivel durante 15 segundos. Vence quem fizer mais cliques. Ate 8 jogadores.',
  '/games/click-frenzy-thumb.svg',
  '/games/click-frenzy-banner.svg',
  'party',
  true,
  true,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'click-frenzy'
);

-- Reaction Duel
update public.games
set
  name = 'Duelo de Reacao',
  name_en = 'Reaction Duel',
  description = 'Duelo de reflexos 1v1. Espera pelo verde e clica mais rapido que o teu adversario.',
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
  name_en,
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
  'Duelo de Reacao',
  'Reaction Duel',
  'Duelo de reflexos 1v1. Espera pelo verde e clica mais rapido que o teu adversario.',
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

-- Corrige jogos conhecidos presos em rascunho (nao reativa jogos desativados pelo admin)
update public.games
set status = 'active'
where slug in (
  'snake',
  'memoria-classica',
  'reacao-rapida',
  'trivia-rapida',
  'click-frenzy',
  'reaction-duel'
)
and status = 'draft';

-- Categorias em falta
insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on (
  (g.slug = 'click-frenzy' and c.slug in ('party', 'arcade')) or
  (g.slug = 'reaction-duel' and c.slug in ('party', 'arcade'))
)
where not exists (
  select 1 from public.game_categories gc
  where gc.game_id = g.id and gc.category_id = c.id
);

-- Builds em falta
insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', g.slug, true
from public.games g
where g.slug in ('click-frenzy', 'reaction-duel')
  and not exists (
    select 1 from public.game_builds b
    where b.game_id = g.id and b.version = '1.0.0'
  );

insert into public.game_stats (game_id)
select g.id
from public.games g
where g.slug in ('click-frenzy', 'reaction-duel')
  and not exists (
    select 1 from public.game_stats s where s.game_id = g.id
  );

notify pgrst, 'reload schema';
