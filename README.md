# PartyUp

Plataforma modular de jogos no browser.

## Arquitetura (Documento 02)

```
src/
├── app/           # Rotas, layouts, providers — sem lógica de negócio
├── components/    # UI reutilizável (layout, shared, ui)
├── features/      # auth, games, home, rankings, rooms
├── hooks/         # useUser, useRoom, useGame
├── lib/           # supabase, games/registry, constants, seo
├── services/      # game, ranking, auth, stats, room, achievements
├── games/         # Módulos de jogo (memory, reaction, trivia)
└── types/         # Tipos globais
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Home (hero, destaques, categorias, rankings, novidades) |
| `/games` | Catálogo com filtros |
| `/games/[slug]` | Página do jogo |
| `/games/[slug]/play` | Execução (code-split) |
| `/rankings` | Rankings globais |
| `/rankings/[slug]` | Ranking por jogo |
| `/profile` | Perfil autenticado |
| `/profile/[username]` | Perfil público |
| `/rooms/[code]` | Sala multiplayer |
| `/login` / `/register` | Autenticação |
| `/admin` | Dashboard admin |

## Começar

```bash
npm install
npm run dev
```

Dark mode é o tema padrão (persistido em `localStorage` via `next-themes`).

## Supabase (Documento 03)

Copia `.env.example` → `.env.local` e aplica migrations:

```bash
npx supabase db reset
```

Ver `supabase/DATABASE.md` para tabelas, buckets e Realtime.

## Novo jogo

1. Módulo em `src/games/<id>/` (contrato em `src/lib/games/types.ts`)
2. Registo em `src/lib/games/registry.ts`
3. Metadados em `src/lib/games/catalog.ts` e/ou Supabase

A navegação e a arquitetura **não** precisam de alterações.
