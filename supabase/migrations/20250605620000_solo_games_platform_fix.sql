-- Garante jogos solo na BD (memoria, reacao, trivia) com builds e flags corretas.
-- Corrige create_game_room para respeitar supports_multiplayer no schema inicial.

alter table public.games
  add column if not exists category text,
  add column if not exists is_multiplayer boolean,
  add column if not exists name_en text;

-- Memoria classica
update public.games
set
  name = 'Memoria Classica',
  name_en = 'Classic Memory',
  description = 'Encontra todos os pares de cartas o mais rapido possivel.',
  thumbnail_url = '/games/memoria-thumb.svg',
  banner_url = '/games/memoria-banner.svg',
  category = 'puzzle',
  is_multiplayer = false,
  supports_mobile = true,
  supports_desktop = true,
  status = 'active'
where slug = 'memoria-classica';

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
  'memoria-classica',
  'Memoria Classica',
  'Classic Memory',
  'Encontra todos os pares de cartas o mais rapido possivel.',
  '/games/memoria-thumb.svg',
  '/games/memoria-banner.svg',
  'puzzle',
  false,
  true,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'memoria-classica'
);

-- Reacao rapida
update public.games
set
  name = 'Reacao Rapida',
  name_en = 'Quick Reaction',
  description = 'Clica quando o ecran ficar verde. Testa os teus reflexos.',
  thumbnail_url = '/games/reacao-thumb.svg',
  banner_url = '/games/reacao-banner.svg',
  category = 'arcade',
  is_multiplayer = false,
  supports_mobile = true,
  supports_desktop = true,
  status = 'active'
where slug = 'reacao-rapida';

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
  'reacao-rapida',
  'Reacao Rapida',
  'Quick Reaction',
  'Clica quando o ecran ficar verde. Testa os teus reflexos.',
  '/games/reacao-thumb.svg',
  '/games/reacao-banner.svg',
  'arcade',
  false,
  true,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'reacao-rapida'
);

-- Trivia rapida
update public.games
set
  name = 'Trivia Rapida',
  name_en = 'Quick Trivia',
  description = 'Responde a perguntas de cultura geral contra o relogio.',
  thumbnail_url = '/games/trivia-thumb.svg',
  banner_url = '/games/trivia-banner.svg',
  category = 'trivia',
  is_multiplayer = false,
  supports_mobile = false,
  supports_desktop = true,
  status = 'active'
where slug = 'trivia-rapida';

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
  'trivia-rapida',
  'Trivia Rapida',
  'Quick Trivia',
  'Responde a perguntas de cultura geral contra o relogio.',
  '/games/trivia-thumb.svg',
  '/games/trivia-banner.svg',
  'trivia',
  false,
  false,
  true,
  'active'
where not exists (
  select 1 from public.games where slug = 'trivia-rapida'
);

-- Schema inicial: supports_multiplayer
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'supports_multiplayer'
  ) then
    update public.games
    set supports_multiplayer = case slug
      when 'click-frenzy' then true
      when 'reaction-duel' then true
      else false
    end
    where slug in (
      'snake',
      'memoria-classica',
      'reacao-rapida',
      'trivia-rapida',
      'click-frenzy',
      'reaction-duel'
    );
  end if;
end $$;

-- Categorias
insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on (
  (g.slug = 'memoria-classica' and c.slug in ('puzzle', 'memory')) or
  (g.slug = 'reacao-rapida' and c.slug = 'arcade') or
  (g.slug = 'trivia-rapida' and c.slug in ('trivia', 'party'))
)
where not exists (
  select 1 from public.game_categories gc
  where gc.game_id = g.id and gc.category_id = c.id
);

-- Builds (modulo em build_url para stats/leaderboard)
insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', v.build_url, true
from public.games g
join (
  values
    ('memoria-classica', 'memory'),
    ('reacao-rapida', 'reaction'),
    ('trivia-rapida', 'trivia')
) as v(slug, build_url) on v.slug = g.slug
where not exists (
  select 1 from public.game_builds b
  where b.game_id = g.id and b.version = '1.0.0'
);

update public.game_builds b
set build_url = v.build_url, is_active = true
from public.games g
join (
  values
    ('memoria-classica', 'memory'),
    ('reacao-rapida', 'reaction'),
    ('trivia-rapida', 'trivia')
) as v(slug, build_url) on v.slug = g.slug
where b.game_id = g.id and b.version = '1.0.0';

insert into public.game_stats (game_id)
select g.id
from public.games g
where g.slug in ('memoria-classica', 'reacao-rapida', 'trivia-rapida')
  and not exists (
    select 1 from public.game_stats s where s.game_id = g.id
  );

-- create_game_room: is_multiplayer OU supports_multiplayer
create or replace function public.create_game_room(
  p_game_slug text,
  p_code text,
  p_guest_name text default 'Convidado',
  p_max_players int default 2
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_player_id uuid;
  v_multiplayer boolean;
  v_guest text;
  v_status text := 'waiting';
  v_cols text := 'code, game_id';
  v_vals text;
  v_pcols text;
  v_pvals text;
  v_has_is_multiplayer boolean;
  v_has_supports_multiplayer boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'is_multiplayer'
  ) into v_has_is_multiplayer;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'supports_multiplayer'
  ) into v_has_supports_multiplayer;

  if v_has_is_multiplayer and v_has_supports_multiplayer then
    select g.id, coalesce(g.is_multiplayer, g.supports_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug
      and g.status::text in ('active', 'published');
  elsif v_has_is_multiplayer then
    select g.id, coalesce(g.is_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug
      and g.status::text in ('active', 'published');
  elsif v_has_supports_multiplayer then
    select g.id, coalesce(g.supports_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug
      and g.status::text in ('active', 'published');
  else
    select g.id, false
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug
      and g.status::text in ('active', 'published');
  end if;

  if v_game_id is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if not v_multiplayer then
    raise exception 'not_multiplayer' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'room_status' and e.enumlabel = 'waiting'
  ) then
    v_status := 'lobby';
  end if;

  v_vals := format('%L, %L', p_code, v_game_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_user_id'
  ) then
    v_cols := v_cols || ', host_user_id';
    v_vals := v_vals || format(', %L', v_user_id);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_id'
  ) then
    v_cols := v_cols || ', host_id';
    v_vals := v_vals || format(', %L', v_user_id);
  end if;

  v_cols := v_cols || ', status';
  v_vals := v_vals || format(', %L', v_status);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    v_cols := v_cols || ', max_players';
    v_vals := v_vals || format(', %s', p_max_players);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  ) then
    v_cols := v_cols || ', metadata';
    v_vals := v_vals || ', ''{}''::jsonb';
  end if;

  execute format(
    'insert into public.rooms (%s) values (%s) returning id',
    v_cols,
    v_vals
  )
  into v_room_id;

  v_pcols := 'room_id';
  v_pvals := format('%L', v_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || format(
      ', %L',
      case when v_user_id is null then v_guest else null end
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', true';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format(
    'insert into public.room_players (%s) values (%s) returning id',
    v_pcols,
    v_pvals
  )
  into v_player_id;

  return json_build_object(
    'room_id', v_room_id,
    'code', p_code,
    'player_id', v_player_id,
    'game_id', v_game_id
  );
end;
$$;

revoke all on function public.create_game_room(text, text, text, int) from public;
grant execute on function public.create_game_room(text, text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
