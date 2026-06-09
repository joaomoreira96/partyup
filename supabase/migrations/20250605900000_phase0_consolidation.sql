-- =============================================================================
-- Phase 0 — Consolidação aditiva do schema dos jogos
--
-- Objetivos:
--   * Preparar a tabela `games` para o sistema V2 de submissões sem partir
--     nada do que já existe (todas as alterações são aditivas).
--   * Garantir consistência dos dados que se foram "duplicando" entre o schema
--     inicial e o schema do Document 03 (is_multiplayer vs supports_multiplayer,
--     module_id em falta no schema hosted, etc.).
--   * Introduzir as colunas `runtime` e `sdk_version` necessárias para suportar
--     em paralelo jogos nativos (atuais 6) e jogos do pipeline V2 (iframe).
--
-- Nenhuma coluna é removida nesta fase.
-- Todas as operações verificam existência de colunas (schema hosted diverge).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Novo enum: como é que a plataforma corre cada jogo
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.game_runtime as enum ('native', 'iframe');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Colunas aditivas em `games` (uma de cada vez — evita falha em cascata)
-- ---------------------------------------------------------------------------
alter table public.games
  add column if not exists runtime public.game_runtime not null default 'native';

alter table public.games
  add column if not exists sdk_version text not null default '1.0';

alter table public.games
  add column if not exists supports_multiplayer boolean;

alter table public.games
  add column if not exists module_id text;

alter table public.games
  add column if not exists min_players integer;

alter table public.games
  add column if not exists max_players integer;

-- ---------------------------------------------------------------------------
-- Backfills idempotentes
-- ---------------------------------------------------------------------------

-- supports_multiplayer ← is_multiplayer quando o primeiro está em falta
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'is_multiplayer'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'supports_multiplayer'
  ) then
    update public.games
    set supports_multiplayer = is_multiplayer
    where supports_multiplayer is null
      and is_multiplayer is not null;
  end if;
end $$;

-- supports_multiplayer: default false (solo) quando ainda null
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'supports_multiplayer'
  ) then
    update public.games
    set supports_multiplayer = false
    where supports_multiplayer is null;

    alter table public.games
      alter column supports_multiplayer set default false;

    -- Só força NOT NULL se já não houver nulls (evita erro 23502)
    if not exists (
      select 1 from public.games where supports_multiplayer is null
    ) then
      alter table public.games
        alter column supports_multiplayer set not null;
    end if;
  end if;
end $$;

-- module_id ← slug quando vazio
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'module_id'
  ) then
    update public.games
    set module_id = case slug
      when 'memoria-classica' then 'memory'
      when 'reacao-rapida'    then 'reaction'
      when 'trivia-rapida'    then 'trivia'
      else slug
    end
    where module_id is null or module_id = '';
  end if;
end $$;

-- runtime = native (idempotente)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'runtime'
  ) then
    update public.games
    set runtime = 'native'::public.game_runtime
    where runtime is null;
  end if;
end $$;

-- min_players / max_players coerentes com supports_multiplayer
do $$
declare
  v_has_min boolean;
  v_has_max boolean;
  v_has_mp  boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'min_players'
  ) into v_has_min;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'max_players'
  ) into v_has_max;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'supports_multiplayer'
  ) into v_has_mp;

  if v_has_min and v_has_max then
    if v_has_mp then
      update public.games
      set
        min_players = coalesce(min_players, case when supports_multiplayer then 2 else 1 end),
        max_players = coalesce(max_players, case when supports_multiplayer then 8 else 1 end)
      where min_players is null or max_players is null;
    else
      update public.games
      set
        min_players = coalesce(min_players, 1),
        max_players = coalesce(max_players, 1)
      where min_players is null or max_players is null;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Índices auxiliares
-- Nota: não usar status::text no predicado — cast para text não é IMMUTABLE
--       e o PostgreSQL rejeita com 42P17.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'game_status' and e.enumlabel = 'active'
  ) then
    execute $idx$
      create index if not exists games_runtime_idx
      on public.games (runtime)
      where status = 'active'::public.game_status
    $idx$;
  elsif exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'game_status' and e.enumlabel = 'published'
  ) then
    execute $idx$
      create index if not exists games_runtime_idx
      on public.games (runtime)
      where status = 'published'::public.game_status
    $idx$;
  else
    create index if not exists games_runtime_idx on public.games (runtime);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Comentários (ignorados se a coluna não existir — comentário falha silenciosamente? No, comment fails)
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'runtime'
  ) then
    comment on column public.games.runtime is
      'Como a plataforma corre o jogo. native = módulo React do monorepo; iframe = bundle V2 servido do bucket game-builds.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'sdk_version'
  ) then
    comment on column public.games.sdk_version is
      'Versão do PartyUp SDK que o jogo declara suportar (manifest.sdkVersion). Default 1.0 para os jogos nativos atuais.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'supports_multiplayer'
  ) then
    comment on column public.games.supports_multiplayer is
      'Substitui o legacy is_multiplayer. Mantemos is_multiplayer enquanto há código legado a lê-lo.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'module_id'
  ) then
    comment on column public.games.module_id is
      'Apenas relevante para runtime = native. Para iframe, o build é resolvido via game_builds.build_url.';
  end if;
end $$;

notify pgrst, 'reload schema';
