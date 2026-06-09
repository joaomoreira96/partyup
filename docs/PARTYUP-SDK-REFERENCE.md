# PartyUp SDK Reference (v1.0)

Documentação para **developers externos** que publicam jogos via pipeline V2 (`runtime = iframe`).

Jogos nativos do monorepo PartyUp usam o SDK TypeScript em processo — este guia cobre **apenas o SDK iframe** (`public/partyup-sdk.js` + `postMessage`).

---

## Princípio

```
Jogo (iframe) → partyup-sdk.js → postMessage → PartyUp → /api/sdk/* → Supabase
```

- O jogo **nunca** acede ao Supabase, cookies de sessão da plataforma, nem ao DOM parent.
- Toda a persistência (sessões, rankings, achievements) passa pela plataforma, que valida scores server-side.

---

## Requisitos

| Requisito | Valor |
|-----------|--------|
| SDK suportada | `1.0` (`manifest.sdkVersion`) |
| Formato pacote | ZIP ≤ 50 MB |
| Runtime | `iframe` (atribuído na publicação) |
| Conta submissão | role `developer` ou `admin` |

---

## Estrutura do ZIP

```
manifest.json
thumbnail.png          # 512×512 recomendado
banner.png             # 1200×630 recomendado
build/
  index.html           # entry point (obrigatório)
  partyup-sdk.js       # copiar de public/partyup-sdk.js
  assets/              # opcional (imagens, áudio, css, js)
```

### manifest.json (mínimo)

```json
{
  "name": "Meu Jogo",
  "slug": "meu-jogo",
  "version": "1.0.0",
  "author": "Studio",
  "description": "Descrição curta",
  "sdkVersion": "1.0",
  "minPlayers": 1,
  "maxPlayers": 1,
  "supportsDesktop": true,
  "supportsTablet": true,
  "supportsMobile": true,
  "categories": ["arcade"],
  "tags": ["casual"]
}
```

Campos opcionais: `achievements[]` (code, name, description, icon).

---

## Gerar ZIP automaticamente

No repositório PartyUp:

```bash
npm run package:sandbox
# ou
node scripts/package-game-submission.mjs -t scripts/game-submissions/partyup-sandbox
```

Output: `dist/submissions/partyup-sandbox-1.0.1.zip` (pronto para upload).

Para o teu jogo, duplica `scripts/game-submissions/partyup-sandbox/`, edita `manifest.json` e `build/`, e corre o script com `-t`.

---

## Incluir o SDK no jogo

```html
<script src="./partyup-sdk.js"></script>
<script>
  PartyUp.ready().then(function (init) {
    console.log(init.user, init.game, init.language);
  });
</script>
```

O ficheiro `partyup-sdk.js` deve estar **no ZIP** (pasta `build/`). A plataforma também o serve em `/partyup-sdk.js`, mas o iframe corre num origin diferente (storage Supabase), por isso o script tem de ir no pacote.

---

## Handshake

1. O jogo carrega e chama `PartyUp.ready()` (automático no load).
2. SDK envia `READY` ao parent via `postMessage`.
3. A plataforma responde com `INIT`:

```json
{
  "user": { "id": "uuid|null", "displayName": "Nome", "isGuest": false },
  "language": "pt",
  "game": {
    "id": "uuid",
    "slug": "meu-jogo",
    "name": "Meu Jogo",
    "version": "1.0.0",
    "metric": "score",
    "maxScore": 10000000
  },
  "room": null,
  "session": { "id": "uuid" }
}
```

4. A promise de `PartyUp.ready()` resolve com este payload.

Canal único — todas as mensagens incluem `source: "partyup-sdk"`.

---

## API — `window.PartyUp`

### Lifecycle

| Método | Descrição |
|--------|-----------|
| `ready()` | `Promise<InitPayload>` — aguarda handshake |
| `startGame()` | `Promise<void>` — regista início (`POST /api/sdk/game/start`) |
| `endGame(payload)` | `Promise<EndGameResult>` — fecha sessão + ranking |
| `submitScore(score)` | `Promise<void>` — leaderboard intermédio (utilizadores autenticados) |
| `reportScore(score)` | `Promise<void>` — atualiza UI parent, sem API |

### Contexto (leitura)

| Método | Retorno |
|--------|---------|
| `getCurrentUser()` | `{ id?, displayName, isGuest }` |
| `getCurrentLanguage()` | `"pt"` \| `"en"` \| … |
| `getCurrentGame()` | `{ id, slug, name, version?, metric?, maxScore? }` |
| `getCurrentRoom()` | `{ code, status, players }` \| `null` |
| `getSessionId()` | `string` |

### Multiplayer (Fase 4 — não implementado)

| Método | Comportamento |
|--------|----------------|
| `createRoom()` | Rejeita com erro |
| `joinRoom()` | Rejeita com erro |
| `leaveRoom()` | Funcional se entraste numa sala via plataforma |
| `sendRoomEvent()` | Rejeita com erro |

---

## endGame — payload

```javascript
await PartyUp.endGame({
  score: 120,           // número ≥ 0
  durationMs: 28500,    // duração da ronda em ms
  metric: "score",      // opcional; default da plataforma
  achievementHints: [], // opcional: FIRST_WIN, PERFECT_SCORE, SPEED_RUN, GAMES_100
});
```

Resposta:

```javascript
{ ranked: true, unlockedAchievements: [...] }
```

- **Convidados**: sessão pode ser registada; `ranked` é `false`.
- **Autenticados**: score validado (soft/hard limits) antes de entrar no leaderboard.

---

## Fluxo recomendado

```javascript
PartyUp.ready().then(async (init) => {
  await PartyUp.startGame();
  // … gameplay …
  PartyUp.reportScore(liveScore); // opcional, durante o jogo
  const result = await PartyUp.endGame({ score: finalScore, durationMs: elapsed });
});
```

Ordem obrigatória: `ready` → `startGame` → `endGame`.  
`submitScore` é opcional para updates intermédios (só contas registadas).

---

## Eventos emitidos pelo SDK

O SDK envia eventos à plataforma (parent):

| Evento | Quando |
|--------|--------|
| `GAME_READY` | Após `INIT` |
| `GAME_STARTED` | Após `startGame()` |
| `GAME_FINISHED` | Após `endGame()` |
| `SCORE_SUBMITTED` | Após `submitScore()` |
| `ROOM_LEAVE` | Após `leaveRoom()` |

Podes também chamar `PartyUp.emit("CUSTOM_EVENT", { ... })` para telemetria futura.

---

## Assets

- Usa caminhos **relativos** a `build/index.html` (`./assets/sprite.png`).
- Não hardcodes URLs da plataforma para assets do jogo.
- Após publicação, ficheiros vivem em `game-builds/{slug}/{version}/`.

---

## Publicação (pipeline V2)

1. Gera ZIP (`npm run package:sandbox` ou script manual).
2. Admin → **Submissões** → upload ZIP.
3. Admin aprova → **Publicar**.
4. Jogo aparece no catálogo com `runtime = iframe`.
5. Jogadores abrem `/games/{slug}/play`.

Nenhuma alteração ao código da plataforma é necessária por jogo.

---

## Jogo de referência

**PartyUp Sandbox** (`scripts/game-submissions/partyup-sandbox/`):

- Ronda de 30 s, tocar alvos, score + ranking.
- Demonstra `ready`, `startGame`, `reportScore`, `endGame`.
- Pacote: `npm run package:sandbox` → upload `dist/submissions/partyup-sandbox-1.0.1.zip`.

---

## Sandbox iframe (segurança)

A plataforma renderiza:

```html
<iframe sandbox="allow-scripts allow-pointer-lock" ... />
```

Proibido: `allow-top-navigation`, `allow-popups`, `allow-modals`, `allow-same-origin`.

---

## Erros comuns

| Sintoma | Causa provável |
|---------|----------------|
| “SDK indisponível” / timeout handshake | `partyup-sdk.js` em falta no ZIP |
| Jogo carrega mas score não entra no ranking | Utilizador convidado ou `endGame` não chamado |
| Upload rejeitado | `manifest.json` inválido ou ficheiros em falta |
| Publicação falha | Ver `detail` na UI admin; migrations em falta no hosted |

---

## Validação local

Antes do upload, confirma:

- [ ] `build/index.html` abre localmente (sem SDK functions — esperado)
- [ ] ZIP contém os 5 ficheiros obrigatórios
- [ ] `sdkVersion` = `"1.0"`
- [ ] `slug` só usa `a-z`, `0-9`, hífens
- [ ] Sem ficheiros `.sql`, `.exe`, `node_modules/`

---

## Versões

| Versão SDK | Estado |
|------------|--------|
| 1.0 | Actual — iframe + postMessage |

---

## Ver também

- [GAME-INTEGRATION.md](./GAME-INTEGRATION.md) — jogos nativos do monorepo
- `public/partyup-sdk.js` — implementação cliente
- `src/lib/partyup-sdk/protocol.ts` — protocolo parent

---

## Suporte

Submissões e aprovação: equipa PartyUp (admin).  
Para bugs da plataforma/SDK, abre issue no repositório interno.
