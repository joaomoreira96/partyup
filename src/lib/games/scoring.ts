/** Pontuação máxima prática alinhada com reaction-duel e snake (runs típicas ~125–250). */
export const PLATFORM_SCORE_MAX = 250;

/** Tempo de reação (ms) → pontos. Partilhado com reaction-duel. */
export function reactionScore(reactionMs: number): number {
  return Math.max(0, Math.round((1000 - reactionMs) / 4));
}

export function memoryScore(params: {
  moves: number;
  durationMs: number;
  pairCount: number;
}): number {
  const { moves, durationMs, pairCount } = params;
  const minMoves = pairCount;
  const movePenalty = Math.max(0, moves - minMoves) * 10;
  const timePenalty = Math.floor(durationMs / 400);
  return Math.max(10, Math.round(PLATFORM_SCORE_MAX - movePenalty - timePenalty));
}

export function triviaScore(params: {
  correct: number;
  total: number;
  durationMs: number;
}): number {
  const { correct, total, durationMs } = params;
  if (total <= 0) return 0;

  const accuracyPoints = Math.round((correct / total) * 200);
  const speedBonus = Math.max(0, Math.round(50 * (1 - durationMs / 90_000)));
  return Math.min(PLATFORM_SCORE_MAX, accuracyPoints + speedBonus);
}
