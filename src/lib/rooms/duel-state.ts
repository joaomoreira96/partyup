import {
  isRoundComplete,
  type RoundCompletionContext,
} from "@/lib/rooms/round-completion";

export type DuelPhase =
  | "lobby"
  | "scheduled"
  | "countdown"
  | "waiting_red"
  | "green"
  | "results";

export type DuelPlayerResult = {
  playerId: string;
  displayName: string;
  reactionMs: number | null;
  tooEarly: boolean;
  score: number;
};

export type DuelRoomMetadata = {
  phase: DuelPhase;
  roundId: string;
  countdownStartAt: number | null;
  greenAt: number | null;
  winnerPlayerId: string | null;
  results: DuelPlayerResult[];
  /** Snapshot de jogadores activos no início da ronda */
  activePlayerIds?: string[];
  /** Resultados necessários para fechar a ronda (salas maiores) */
  resultsNeeded?: number;
};

/** Tempo para ambos os jogadores abrirem a página antes do 3-2-1 */
export const SYNC_LEAD_MS = 6500;
export const COUNTDOWN_MS = 3000;
export const GREEN_DELAY_MIN_MS = 3500;
export const GREEN_DELAY_MAX_MS = 8000;
/** Mínimo de ecrã vermelho visível após entrada tardia na página de jogo */
export const LATE_JOIN_RED_MS = 1800;
export const DUEL_TICK_MS = 50;

export { reactionScore } from "@/lib/games/scoring";

export function parseDuelMetadata(raw: unknown): DuelRoomMetadata {
  const base = createInitialDuelMetadata();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<DuelRoomMetadata>;
  return {
    ...base,
    ...data,
    results: Array.isArray(data.results) ? data.results : [],
  };
}

export function createInitialDuelMetadata(): DuelRoomMetadata {
  return {
    phase: "lobby",
    roundId: crypto.randomUUID(),
    countdownStartAt: null,
    greenAt: null,
    winnerPlayerId: null,
    results: [],
    activePlayerIds: [],
    resultsNeeded: 0,
  };
}

export function createCountdownMetadata(now = Date.now()): DuelRoomMetadata {
  const countdownStartAt = now + SYNC_LEAD_MS;
  const waitMs =
    GREEN_DELAY_MIN_MS +
    Math.floor(Math.random() * (GREEN_DELAY_MAX_MS - GREEN_DELAY_MIN_MS + 1));

  return {
    phase: "scheduled",
    roundId: crypto.randomUUID(),
    countdownStartAt,
    greenAt: countdownStartAt + COUNTDOWN_MS + waitMs,
    winnerPlayerId: null,
    results: [],
    activePlayerIds: [],
    resultsNeeded: 0,
  };
}

export function phaseFromTimestamps(
  metadata: DuelRoomMetadata,
  now = Date.now(),
  roundCtx?: RoundCompletionContext
): DuelPhase {
  if (metadata.phase === "results") return "results";

  if (roundCtx && isRoundComplete(metadata, roundCtx)) return "results";

  if (!metadata.countdownStartAt || !metadata.greenAt) return metadata.phase;

  if (now < metadata.countdownStartAt) return "scheduled";
  if (now < metadata.countdownStartAt + COUNTDOWN_MS) return "countdown";
  if (now < metadata.greenAt) return "waiting_red";
  return "green";
}

