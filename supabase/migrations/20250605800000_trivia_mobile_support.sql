-- Trivia Rápida: suporte mobile (tablet usa o mesmo flag no schema hosted).

update public.games
set
  supports_mobile = true,
  updated_at = now()
where slug = 'trivia-rapida';
