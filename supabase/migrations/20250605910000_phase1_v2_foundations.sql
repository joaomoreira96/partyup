-- =============================================================================
-- Phase 1 — Fundações do sistema V2 de submissão de jogos
--
-- Esta migration introduz todos os blocos de BD/Storage que o pipeline de
-- submissão (Fase 2+) vai precisar, mas NÃO altera o fluxo atual:
--   * Os 6 jogos nativos continuam exatamente como estão (runtime = 'native').
--   * Não há ainda upload de pacotes — apenas a fundação que torna isso
--     possível sem mais nenhuma migration de schema.
--
-- Conteúdo:
--   * Enums:   submission_status  (user_role 'developer' → migration 20250605909500)
--   * Tabelas: tags, game_tags, game_submissions
--   * Coluna:  achievements.game_id  (achievements declarados por manifest)
--   * Storage: bucket 'game-builds' + policies (apenas admin escreve)
--   * Helpers: is_admin(), is_developer_or_admin()
--   * RPCs:    admin_review_submission(id, action, notes)
--   * RLS:     deny-by-default + leitura controlada
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.submission_status as enum (
    'pending',
    'approved',
    'rejected',
    'published'
  );
exception when duplicate_object then null;
end $$;

-- NOTA: role 'developer' está em 20250605909500_user_role_developer.sql
-- (tem de ser commitada antes desta migration — ver erro 55P04).

-- ---------------------------------------------------------------------------
-- Trigger helper (pode faltar no schema hosted se document03 não foi aplicado)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, search_path bloqueado)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_developer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'developer')
  );
$$;

revoke all on function public.is_developer_or_admin() from public;
grant execute on function public.is_developer_or_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Tags (declaráveis no manifest, validadas e armazenadas pela plataforma)
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_tags (
  game_id uuid not null references public.games (id) on delete cascade,
  tag_id  uuid not null references public.tags  (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, tag_id)
);

create index if not exists tags_slug_idx on public.tags (slug);
create index if not exists game_tags_game_idx on public.game_tags (game_id);
create index if not exists game_tags_tag_idx  on public.game_tags (tag_id);

alter table public.tags enable row level security;
alter table public.game_tags enable row level security;

drop policy if exists "tags_select_public" on public.tags;
create policy "tags_select_public"
  on public.tags for select using (true);

drop policy if exists "tags_admin_all" on public.tags;
create policy "tags_admin_all"
  on public.tags for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "game_tags_select_public" on public.game_tags;
create policy "game_tags_select_public"
  on public.game_tags for select using (true);

drop policy if exists "game_tags_admin_all" on public.game_tags;
create policy "game_tags_admin_all"
  on public.game_tags for all
  using (public.is_admin())
  with check (public.is_admin());

-- updated_at trigger para tags
drop trigger if exists set_updated_at on public.tags;
create trigger set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Achievements declarados por manifest podem ser ligados a um jogo específico
-- (achievements de plataforma continuam com game_id = NULL)
-- ---------------------------------------------------------------------------
alter table public.achievements
  add column if not exists game_id uuid references public.games (id) on delete set null;

create index if not exists achievements_game_idx
  on public.achievements (game_id)
  where game_id is not null;

comment on column public.achievements.game_id is
  'NULL = achievement de plataforma (cross-game). UUID = declarado por manifest de um jogo específico.';

-- ---------------------------------------------------------------------------
-- game_submissions — núcleo do pipeline V2
-- ---------------------------------------------------------------------------
create table if not exists public.game_submissions (
  id uuid primary key default gen_random_uuid(),

  -- quem submeteu (developer/admin)
  user_id uuid not null references auth.users (id) on delete cascade,

  -- meta-informação extraída do manifest (validada pela API antes do insert)
  game_name   text not null,
  slug        text not null,
  version     text not null,
  sdk_version text not null,
  manifest    jsonb not null,

  -- localização do pacote no Storage (pasta com index.html, assets/, locales/…)
  storage_path text not null,
  size_bytes   bigint not null,
  checksum     text not null,  -- sha256 do ZIP original

  -- review
  status         public.submission_status not null default 'pending',
  review_notes   text,
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,

  -- referência ao game publicado (preenchida após status = 'published')
  published_game_id uuid references public.games (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (slug, version)
);

create index if not exists game_submissions_status_idx
  on public.game_submissions (status, created_at desc);

create index if not exists game_submissions_user_idx
  on public.game_submissions (user_id, created_at desc);

create index if not exists game_submissions_slug_idx
  on public.game_submissions (slug);

alter table public.game_submissions enable row level security;

-- Cada developer vê as suas próprias submissões; admin vê todas
drop policy if exists "game_submissions_select_own_or_admin" on public.game_submissions;
create policy "game_submissions_select_own_or_admin"
  on public.game_submissions for select
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

-- Apenas developer/admin pode inserir
drop policy if exists "game_submissions_insert_developer" on public.game_submissions;
create policy "game_submissions_insert_developer"
  on public.game_submissions for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and public.is_developer_or_admin()
  );

-- Apenas admin pode atualizar (review/publish/reject)
drop policy if exists "game_submissions_update_admin" on public.game_submissions;
create policy "game_submissions_update_admin"
  on public.game_submissions for update
  using (public.is_admin())
  with check (public.is_admin());

-- Apenas admin pode apagar
drop policy if exists "game_submissions_delete_admin" on public.game_submissions;
create policy "game_submissions_delete_admin"
  on public.game_submissions for delete
  using (public.is_admin());

drop trigger if exists set_updated_at on public.game_submissions;
create trigger set_updated_at
  before update on public.game_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: admin_review_submission — muda status para approved | rejected
-- A publicação ('published') tem RPC própria em Fase 2 porque envolve
-- escrever em games / game_builds / game_categories / game_tags / achievements
-- numa única transação.
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_submission(
  p_id uuid,
  p_action text,   -- 'approve' | 'reject'
  p_notes  text default null
)
returns public.game_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.game_submissions;
  v_new_status public.submission_status;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    v_new_status := 'approved';
  elsif p_action = 'reject' then
    v_new_status := 'rejected';
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  update public.game_submissions
  set
    status       = v_new_status,
    review_notes = coalesce(p_notes, review_notes),
    reviewed_by  = auth.uid(),
    reviewed_at  = now(),
    updated_at   = now()
  where id = p_id
    and status in ('pending', 'approved', 'rejected')
  returning * into v_row;

  if not found then
    raise exception 'submission_not_found_or_published' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_review_submission(uuid, text, text) from public;
grant execute on function public.admin_review_submission(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket 'game-builds' (50 MB por ficheiro, alinhado com doc V2)
-- Conteúdo permitido: HTML, JS, CSS, imagens (incluindo SVG controlado),
-- áudio (mp3/wav/ogg) e JSON (manifest + locales).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-builds',
  'game-builds',
  true,
  52428800,
  array[
    'text/html',
    'application/javascript',
    'text/javascript',
    'text/css',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/json',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types= excluded.allowed_mime_types;

-- Leitura pública (jogos servidos para o iframe)
drop policy if exists "game_builds_public_read" on storage.objects;
create policy "game_builds_public_read"
  on storage.objects for select
  using (bucket_id = 'game-builds');

-- Escrita: apenas admins (a route do pipeline corre como service_role do lado
-- do servidor; este policy bloqueia qualquer tentativa direta a partir do
-- cliente, mesmo de um developer autenticado).
drop policy if exists "game_builds_admin_write" on storage.objects;
create policy "game_builds_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'game-builds'
    and public.is_admin()
  );

drop policy if exists "game_builds_admin_update" on storage.objects;
create policy "game_builds_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'game-builds'
    and public.is_admin()
  );

drop policy if exists "game_builds_admin_delete" on storage.objects;
create policy "game_builds_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'game-builds'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Atualizar gatilho updated_at para incluir as novas tabelas (idempotente)
-- ---------------------------------------------------------------------------
do $$ declare t text;
begin
  foreach t in array array['tags', 'game_submissions'] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
