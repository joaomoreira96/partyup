-- Click Frenzy — jogo multiplayer de grupo (1-8 jogadores)
-- Implementacao de referencia para salas com mais de dois jogadores.

-- Garantir colunas/realtime usados pelas salas (idempotente)
alter table public.rooms
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Sem esta coluna, join_game_room e o GET /api/rooms assumem o limite de 2
-- jogadores (omissao do duelo), impedindo o 3o jogador de entrar.
alter table public.rooms
  add column if not exists max_players int not null default 8;

do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end $$;

-- Jogo Click Frenzy (schema hosted)
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

insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on c.slug in ('party', 'arcade')
where g.slug = 'click-frenzy'
  and not exists (
    select 1 from public.game_categories gc
    where gc.game_id = g.id and gc.category_id = c.id
  );

insert into public.game_builds (game_id, version, build_url, is_active)
select g.id, '1.0.0', 'click-frenzy', true
from public.games g
where g.slug = 'click-frenzy'
  and not exists (
    select 1 from public.game_builds b
    where b.game_id = g.id and b.version = '1.0.0'
  );

insert into public.game_stats (game_id)
select g.id from public.games g
where g.slug = 'click-frenzy'
  and not exists (
    select 1 from public.game_stats s where s.game_id = g.id
  );

-- Corrige salas click-frenzy ja existentes que tenham ficado com limite de 2.
update public.rooms r
set max_players = 8
from public.games g
where g.slug = 'click-frenzy'
  and r.game_id = g.id
  and coalesce(r.max_players, 0) < 8;

-- Submissao atomica de cliques por jogador.
-- Cada clique de cada jogador escreve apenas a sua entrada em metadata.scores.
-- Um unico UPDATE com jsonb_set le+escreve a linha sob row lock, evitando
-- perdas de atualizacoes mesmo com 8 jogadores a submeter em simultaneo.
create or replace function public.click_frenzy_submit(
  p_room_id uuid,
  p_player_id text,
  p_clicks int,
  p_last_click_at bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
begin
  if p_room_id is null or p_player_id is null then
    raise exception 'invalid_args' using errcode = 'P0001';
  end if;

  -- Concatenacao de jsonb (||) garante criacao do objeto 'scores' mesmo que
  -- ainda nao exista, ao contrario de jsonb_set que nao cria parents em falta.
  update public.rooms r
  set metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
    'scores',
    coalesce(r.metadata -> 'scores', '{}'::jsonb) || jsonb_build_object(
      p_player_id,
      jsonb_build_object(
        'clicks', greatest(
          coalesce((r.metadata #>> array['scores', p_player_id, 'clicks'])::int, 0),
          greatest(coalesce(p_clicks, 0), 0)
        ),
        'lastClickAt', coalesce(p_last_click_at, 0)
      )
    )
  )
  where r.id = p_room_id
  returning r.metadata into v_meta;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  return v_meta;
end;
$$;

revoke all on function public.click_frenzy_submit(uuid, text, int, bigint) from public;
grant execute on function public.click_frenzy_submit(uuid, text, int, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
