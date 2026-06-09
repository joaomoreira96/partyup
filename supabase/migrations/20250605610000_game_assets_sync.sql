-- Garante URLs de thumbnail/banner para jogos cujo catálogo estático define os assets.

update public.games
set
  thumbnail_url = '/games/memoria-thumb.svg',
  banner_url = '/games/memoria-banner.svg'
where slug = 'memoria-classica';

update public.games
set
  thumbnail_url = '/games/reacao-thumb.svg',
  banner_url = '/games/reacao-banner.svg'
where slug = 'reacao-rapida';

update public.games
set
  thumbnail_url = '/games/trivia-thumb.svg',
  banner_url = '/games/trivia-banner.svg'
where slug = 'trivia-rapida';
