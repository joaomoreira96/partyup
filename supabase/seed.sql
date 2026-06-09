insert into public.categories (slug, name, name_en) values
  ('puzzle', 'Puzzle', 'Puzzle'),
  ('arcade', 'Arcade', 'Arcade'),
  ('memory', 'Memória', 'Memory'),
  ('trivia', 'Trivia', 'Trivia'),
  ('party', 'Party', 'Party'),
  ('strategy', 'Estratégia', 'Strategy')
on conflict (slug) do update set
  name = excluded.name,
  name_en = excluded.name_en;

insert into public.games (
  slug, name, description, thumbnail_url, banner_url, module_id,
  guest_allowed, supports_multiplayer, featured,
  supports_desktop, supports_tablet, supports_mobile, status
) values
  (
    'snake',
    'Snake',
    'Controla a cobra, recolhe comida e tenta obter a maior pontuação possível.',
    '/games/snake-thumb.svg',
    '/games/snake-banner.svg',
    'snake',
    true, false, true,
    true, true, true,
    'active'
  ),
  (
    'memoria-classica',
    'Memória Clássica',
    'Encontra todos os pares de cartas o mais rápido possível.',
    '/games/memoria-thumb.svg',
    '/games/memoria-banner.svg',
    'memory',
    true, false, true,
    true, true, true,
    'active'
  ),
  (
    'reacao-rapida',
    'Reação Rápida',
    'Clica quando o ecrã ficar verde. Testa os teus reflexos.',
    '/games/reacao-thumb.svg',
    '/games/reacao-banner.svg',
    'reaction',
    true, false, true,
    true, true, true,
    'active'
  ),
  (
    'trivia-rapida',
    'Trivia Rápida',
    'Responde a perguntas de cultura geral contra o relógio.',
    '/games/trivia-thumb.svg',
    '/games/trivia-banner.svg',
    'trivia',
    true, false, true,
    true, true, true,
    'active'
  ),
  (
    'click-frenzy',
    'Click Frenzy',
    'Clica o mais rápido possível durante 15 segundos. Vence quem fizer mais cliques. Até 8 jogadores.',
    '/games/click-frenzy-thumb.svg',
    '/games/click-frenzy-banner.svg',
    'click-frenzy',
    true, true, true,
    true, true, true,
    'active'
  ),
  (
    'reaction-duel',
    'Duelo de Reação',
    'Duelo de reflexos 1v1. Espera pelo verde e clica mais rápido que o teu adversário.',
    '/games/reaction-duel-thumb.svg',
    '/games/reaction-duel-banner.svg',
    'reaction-duel',
    true, true, true,
    true, true, true,
    'active'
  )
on conflict (slug) do update set
  status = excluded.status,
  featured = excluded.featured;

update public.games
set name_en = case slug
  when 'memoria-classica' then 'Classic Memory'
  when 'reacao-rapida' then 'Quick Reaction'
  when 'trivia-rapida' then 'Quick Trivia'
  when 'click-frenzy' then 'Click Frenzy'
  when 'reaction-duel' then 'Reaction Duel'
  else name
end
where name_en is null or name_en = '';

update public.games
set description_en = case slug
  when 'snake' then 'Control the snake, collect food and try to get the highest score possible.'
  when 'memoria-classica' then 'Find all matching card pairs as fast as you can. Perfect for short sessions and visual memory training.'
  when 'reacao-rapida' then 'Click when the screen turns green. Test your reflexes and compete for the best reaction time.'
  when 'trivia-rapida' then 'Answer general knowledge questions against the clock. Ideal for quick solo sessions.'
  when 'click-frenzy' then 'Click as fast as you can for 15 seconds. Whoever gets the most clicks wins. Up to 8 players.'
  when 'reaction-duel' then '1v1 reflex duel. Wait for green and click faster than your opponent.'
  else description_en
end
where description_en is null or description_en = '';

insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on (
  (g.slug = 'snake' and c.slug = 'arcade') or
  (g.slug = 'memoria-classica' and c.slug in ('puzzle', 'memory')) or
  (g.slug = 'reacao-rapida' and c.slug = 'arcade') or
  (g.slug = 'trivia-rapida' and c.slug in ('trivia', 'party')) or
  (g.slug = 'click-frenzy' and c.slug in ('party', 'arcade')) or
  (g.slug = 'reaction-duel' and c.slug in ('party', 'arcade'))
)
on conflict do nothing;

insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', g.module_id, true
from public.games g
on conflict (game_id, version) do update set is_active = true;

insert into public.achievements (slug, name, description, icon) values
  ('first_win', 'Primeira vitória', 'Completa o teu primeiro jogo com sucesso.', 'trophy'),
  ('games_100', 'Veterano', 'Joga 100 partidas na plataforma.', 'star'),
  ('top_10', 'Top 10', 'Alcança o top 10 num ranking oficial.', 'medal'),
  ('invite_friend', 'Anfitrião', 'Cria uma sala e recebe um amigo no lobby.', 'users')
on conflict (slug) do nothing;

insert into public.game_stats (game_id)
select id from public.games
on conflict (game_id) do nothing;
