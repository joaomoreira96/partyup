# PartyUp — Schema (Documento 03)

## Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil por utilizador (`auth.users` → trigger) |
| `games` | Metadados dos jogos (`status`: draft, active, disabled) |
| `game_builds` | Versões de build (`is_active` = uma por jogo) |
| `categories` / `game_categories` | Categorias N:N |
| `game_sessions` | Cada partida (score, duração) |
| `leaderboards` | Pontuações por jogo |
| `user_stats` / `game_stats` | Agregados |
| `achievements` / `user_achievements` | Conquistas |
| `game_events` | Analytics (JSONB payload) |
| `rooms` / `room_players` | Multiplayer + Realtime |

## Storage buckets

- `avatars` — upload na pasta `{user_id}/`
- `game-assets` — admin
- `game-banners` — admin
- `news` — admin

## Aplicar migrations

```bash
npx supabase db reset   # local
# ou
npx supabase db push    # remoto
```

Migrations:

1. `20250603000000_initial_schema.sql`
2. `20250603100000_document03_schema.sql`
3. `20250603100001_storage_buckets.sql`
4. `20250603100002_realtime_publication.sql`

## Integração

Os jogos **não** acedem à BD. Usam a API:

- `POST /api/sessions` — fim de partida + ranking
- `POST/PATCH /api/rooms` — salas

Serviços em `src/services/`.
