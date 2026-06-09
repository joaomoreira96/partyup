# PartyUp — Schema (Documento 03 + V2)

## Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil por utilizador (`auth.users` → trigger). Role: `user` \| `developer` \| `admin`. |
| `games` | Metadados dos jogos. `status`: draft/active/disabled. `runtime`: native/iframe. |
| `game_builds` | Versões de build (`is_active` único por jogo). |
| `categories` / `game_categories` | Categorias N:N. |
| `tags` / `game_tags` | **V2** — tags declaráveis por manifest (N:N). |
| `achievements` / `user_achievements` | Conquistas. `achievements.game_id` (V2) liga conquistas a um jogo específico. |
| `game_sessions` | Cada partida (score, duração). |
| `leaderboards` | Pontuações por jogo. `status`: approved \| pending_review \| rejected. |
| `user_stats` / `game_stats` | Agregados. |
| `game_events` | Analytics (JSONB payload). |
| `rooms` / `room_players` | Multiplayer + Realtime. |
| `game_submissions` | **V2** — pipeline de submissão de pacotes ZIP. |
| `security_events`, `user_flags`, `user_bans`, `resource_usage`, `rate_limit_buckets` | Infra de segurança (S1/S2). |

## Storage buckets

- `avatars` — upload na pasta `{user_id}/`
- `game-assets` — admin (assets diversos)
- `game-banners` — admin (banners de jogos legacy)
- `news` — admin
- `game-builds` — **V2** — pacotes de jogos (50 MB por ficheiro). Apenas admin escreve; leitura pública.

## V2 — Sistema de Submissão de Jogos

### Roles
- `user` — utilizador normal.
- `developer` — pode submeter pacotes via `/api/admin/game-submissions` (Fase 2).
- `admin` — pode submeter, aprovar, rejeitar e publicar.

### Estados de uma submissão (`submission_status`)
```
pending → approved → published
   ↘ rejected
```

### Runtime dos jogos
- `runtime = 'native'` — módulo React/TS no monorepo (`src/games/<id>/`). Estado dos 6 jogos atuais.
- `runtime = 'iframe'` — bundle servido a partir do bucket `game-builds` num iframe sandbox (`allow-scripts allow-pointer-lock`). Usado pelo pipeline V2.

A coexistência permite que os jogos atuais continuem a funcionar enquanto novos jogos chegam pelo pipeline.

### RPCs admin (V2)
- `is_admin()` — helper SQL.
- `is_developer_or_admin()` — helper SQL.
- `admin_review_submission(p_id uuid, p_action text, p_notes text)` — `p_action` ∈ `approve` | `reject`.
- `admin_publish_submission(p_id uuid, p_thumbnail_url text, p_banner_url text, p_build_url text)` — publica submissão aprovada no catálogo (`runtime = iframe`).

### Variáveis de ambiente (Fase 2)

```env
SUPABASE_SERVICE_ROLE_KEY=...   # upload server-side para bucket game-builds
```

Sem esta chave, o upload de pacotes ZIP devolve 503.

## Aplicar migrations

```bash
npx supabase db reset   # local
# ou
npx supabase db push    # remoto
```

Migrations principais (ordem):

1. `20250603000000_initial_schema.sql`
2. `20250603100000_document03_schema.sql`
3. `20250603100001_storage_buckets.sql`
4. `20250603100002_realtime_publication.sql`
5. `20250605700000_s1_s2_security.sql` — fundações de segurança.
6. `20250605900000_phase0_consolidation.sql` — **V2 Fase 0**: aditivo, sem breaking changes.
7. `20250605909500_user_role_developer.sql` — **V2 Fase 1a**: enum `developer` (correr/commit separado).
8. `20250605910000_phase1_v2_foundations.sql` — **V2 Fase 1b**: tags, game_submissions, bucket game-builds.
9. `20250605920000_phase2_publish_submission.sql` — **V2 Fase 2**: RPC `admin_publish_submission`.

## Integração

Os jogos **não** acedem à BD. Usam o `PartyUp SDK` (`src/lib/partyup-sdk/`):

- `POST /api/sdk/game/start` — início de sessão
- `POST /api/sdk/game/end` — fim de partida + ranking + achievements
- `POST /api/sdk/score` — submissão de pontuação isolada
- `POST/PATCH /api/rooms` — salas

Serviços em `src/services/`.

## Notas de schema

- `games.is_multiplayer` (legacy) ↔ `games.supports_multiplayer` (atual). Mantemos ambas durante a transição porque ainda há código a ler ambas; as policies usam `supports_multiplayer` como source-of-truth.
- `games.category` (text, legacy) ↔ `game_categories` (N:N atual). O admin escreve em `game_categories` e põe `category = null`. A coluna fica para retrocompatibilidade.
- `games.module_id` — apenas relevante para `runtime = 'native'`. Para `runtime = 'iframe'`, o build é resolvido via `game_builds.build_url` (caminho no bucket).
