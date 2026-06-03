# Integração de Jogos — PartyUp (Documento 05)

## Regra principal

Os jogos **nunca** comunicam com Supabase. Fluxo obrigatório:

```
Jogo → PartyUp SDK → API (/api/sdk/*) → Services → Supabase
```

## Estrutura mínima

```
src/games/<slug>/
  index.ts      # GameModule (mount + cleanup)
  config.ts     # GameConfigSpec
  components/   # opcional
  hooks/        # opcional
  types/        # opcional
```

Registar o módulo em `src/lib/games/registry.ts`.

## Configuração (`config.ts`)

| Campo | Descrição |
|-------|-----------|
| `name` | Nome exibido |
| `slug` | Slug do catálogo |
| `version` | Versão semver |
| `supportsMobile` / `supportsTablet` / `supportsDesktop` | Compatibilidade |
| `minPlayers` / `maxPlayers` | Limites de jogadores |

## SDK — métodos obrigatórios

| Método | Uso |
|--------|-----|
| `startGame()` | Inicia sessão na plataforma |
| `endGame(payload)` | Termina e regista resultado |
| `submitScore({ score })` | Atualização intermédia (utilizadores autenticados) |
| `getCurrentUser()` | Utilizador / convidado |
| `getCurrentRoom()` | Sala (se multiplayer) |
| `leaveRoom()` | Sair da sala |
| `createRoom()` / `joinRoom()` | **Proibido** — lançam erro |

O SDK é injetado em `GameMountContext.sdk` pelo `GamePlayer`.

## Lifecycle

`LOAD` → `READY` → `START` → `PLAYING` → `FINISHED` → `RESULTS`

Chamar `sdk.startGame()` ao iniciar gameplay e `sdk.endGame()` ao terminar.

## Eventos

Emitir via `sdk.emit()` quando relevante: `GAME_STARTED`, `GAME_FINISHED`, `SCORE_SUBMITTED`, etc.

## Multiplayer

A plataforma cria salas e códigos. O jogo apenas recebe `room` e `players` no contexto.

## Rankings e anti-cheat

- `submitScore` / `endGame` passam validação cliente (`validation.ts`) e servidor (`score-validation.service.ts`).
- Conquistas: enviar `achievementHints` (`FIRST_WIN`, `PERFECT_SCORE`, `SPEED_RUN`); a plataforma decide atribuição.

## API routes

| Rota | Função |
|------|--------|
| `POST /api/sdk/game/start` | Início de sessão |
| `POST /api/sdk/game/end` | Fim + stats + ranking |
| `POST /api/sdk/score` | Leaderboard intermédio |
| `POST /api/sdk/room/leave` | Sair da sala |

## Checklist de publicação

- [ ] Build concluída
- [ ] Metadata e assets no Supabase (`games`, storage)
- [ ] Compatibilidade em `config.ts`
- [ ] Testes funcionais, mobile (se aplicável), multiplayer (se aplicável)
- [ ] Sem erros de consola
- [ ] Resize / orientação sem refresh
- [ ] Aprovação administrativa (`status: active`)

## Testes da plataforma

```bash
npm run test          # Vitest (unit)
npm run test:e2e      # Playwright
npm run typecheck     # TypeScript
npm run lint
npm run build
```

Cobertura mínima recomendada: 80%. Fluxos E2E críticos: home, catálogo, login, rankings.

## Adicionar um novo jogo

1. Implementar `src/games/<id>/` com SDK
2. Registar em `registry.ts`
3. Inserir registo em `games` (Supabase)
4. Executar checklist acima

Sem alterações estruturais à plataforma.
