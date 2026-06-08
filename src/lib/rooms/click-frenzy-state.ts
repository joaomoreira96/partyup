// Estado partilhado do Click Frenzy (servidor + cliente, sem APIs de browser).

export const CLICK_FRENZY_DURATION_MS = 15_000;
/** Contagem decrescente visivel antes do GO (folga para ligacoes mais lentas). */
export const CLICK_FRENZY_COUNTDOWN_MS = 5_000;
/** Margem para todos abrirem a pagina de jogo antes da contagem comecar. */
export const CLICK_FRENZY_LEAD_MS = 3_000;
/** Periodicidade de sincronizacao da pontuacao para o servidor. */
export const CLICK_FRENZY_SYNC_MS = 250;
/** Limite defensivo de cliques aceites por ronda. */
export const CLICK_FRENZY_MAX_CLICKS = 5_000;

export type ClickFrenzyPhase = "lobby" | "countdown" | "playing" | "results";

export type ClickFrenzyScore = {
  clicks: number;
  lastClickAt: number;
};

export type ClickFrenzyMetadata = {
  game: "click-frenzy";
  /** Fase grosseira persistida (lobby/playing/results). A fase fina deriva dos timestamps. */
  phase: ClickFrenzyPhase;
  roundId: string;
  countdownStartAt: number | null;
  startAt: number | null;
  endAt: number | null;
  scores: Record<string, ClickFrenzyScore>;
  recorded?: boolean;
};

function newRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createInitialClickFrenzyMetadata(): ClickFrenzyMetadata {
  return {
    game: "click-frenzy",
    phase: "lobby",
    roundId: newRoundId(),
    countdownStartAt: null,
    startAt: null,
    endAt: null,
    scores: {},
    recorded: false,
  };
}

export function createCountdownClickFrenzyMetadata(now = Date.now()): ClickFrenzyMetadata {
  const countdownStartAt = now + CLICK_FRENZY_LEAD_MS;
  const startAt = countdownStartAt + CLICK_FRENZY_COUNTDOWN_MS;
  const endAt = startAt + CLICK_FRENZY_DURATION_MS;

  return {
    game: "click-frenzy",
    phase: "playing",
    roundId: newRoundId(),
    countdownStartAt,
    startAt,
    endAt,
    scores: {},
    recorded: false,
  };
}

function toScores(raw: unknown): Record<string, ClickFrenzyScore> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ClickFrenzyScore> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Partial<ClickFrenzyScore>;
    out[key] = {
      clicks: Math.max(0, Math.round(Number(entry.clicks ?? 0))),
      lastClickAt: Math.max(0, Math.round(Number(entry.lastClickAt ?? 0))),
    };
  }
  return out;
}

export function parseClickFrenzyMetadata(raw: unknown): ClickFrenzyMetadata {
  const base = createInitialClickFrenzyMetadata();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<ClickFrenzyMetadata> & Record<string, unknown>;

  const toNum = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  return {
    game: "click-frenzy",
    phase: (data.phase as ClickFrenzyPhase) ?? base.phase,
    roundId: typeof data.roundId === "string" && data.roundId ? data.roundId : base.roundId,
    countdownStartAt: toNum(data.countdownStartAt),
    startAt: toNum(data.startAt),
    endAt: toNum(data.endAt),
    scores: toScores(data.scores),
    recorded: Boolean(data.recorded),
  };
}

export function deriveClickFrenzyPhase(
  metadata: ClickFrenzyMetadata,
  now = Date.now()
): ClickFrenzyPhase {
  if (metadata.recorded || metadata.phase === "results") return "results";
  if (!metadata.countdownStartAt || !metadata.startAt || !metadata.endAt) {
    return "lobby";
  }
  if (now < metadata.startAt) return "countdown";
  if (now < metadata.endAt) return "playing";
  return "results";
}

export type ClickFrenzyRankEntry = {
  playerId: string;
  clicks: number;
  lastClickAt: number;
  rank: number;
};

/**
 * Ordena por mais cliques; desempate pelo clique vencedor mais cedo
 * (menor lastClickAt entre quem tem o mesmo total).
 */
export function rankClickFrenzyScores(
  scores: Record<string, ClickFrenzyScore>
): ClickFrenzyRankEntry[] {
  const entries = Object.entries(scores).map(([playerId, score]) => ({
    playerId,
    clicks: score.clicks,
    lastClickAt: score.lastClickAt,
  }));

  entries.sort((a, b) => {
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    const aLast = a.lastClickAt || Number.MAX_SAFE_INTEGER;
    const bLast = b.lastClickAt || Number.MAX_SAFE_INTEGER;
    return aLast - bLast;
  });

  let rank = 0;
  let prevClicks: number | null = null;
  let prevLast: number | null = null;
  return entries.map((entry, index) => {
    const tied = prevClicks === entry.clicks && prevLast === entry.lastClickAt;
    rank = tied ? rank : index + 1;
    prevClicks = entry.clicks;
    prevLast = entry.lastClickAt;
    return { ...entry, rank };
  });
}
