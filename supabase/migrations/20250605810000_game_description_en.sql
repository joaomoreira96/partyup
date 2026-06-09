-- Descrições bilíngues dos jogos (description = PT, description_en = EN)

alter table public.games
  add column if not exists description_en text;

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
