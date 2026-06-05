import type { DuelPlayerResult, DuelRoomMetadata } from "@/lib/rooms/duel-state";

export type RoundCompletionContext = {
  playerCount: number;
  maxPlayers?: number;
};

/** Tamanho fixo de ronda para duelos 1v1 */
export const DUEL_ROUND_SIZE = 2;

/** Junta resultados por playerId (último vence em caso de duplicado). */
export function mergeDuelResults(
  ...sources: DuelPlayerResult[][]
): DuelPlayerResult[] {
  const byId = new Map<string, DuelPlayerResult>();
  for (const list of sources) {
    for (const entry of list) {
      byId.set(entry.playerId, entry);
    }
  }
  return [...byId.values()];
}

export function countUniqueResults(results: DuelPlayerResult[]): number {
  return new Set(results.map((r) => r.playerId)).size;
}

/**
 * Quantos jogadores têm de submeter resultado para fechar a ronda.
 * Prioridade: metadata.resultsNeeded → activePlayerIds → jogadores na sala.
 */
export function resolveResultsNeeded(
  metadata: DuelRoomMetadata,
  ctx: RoundCompletionContext
): number {
  const max = ctx.maxPlayers ?? DUEL_ROUND_SIZE;
  let needed = DUEL_ROUND_SIZE;

  if (typeof metadata.resultsNeeded === "number" && metadata.resultsNeeded > 0) {
    needed = metadata.resultsNeeded;
  } else if (metadata.activePlayerIds?.length) {
    needed = metadata.activePlayerIds.length;
  } else {
    needed = Math.min(Math.max(ctx.playerCount, DUEL_ROUND_SIZE), max);
  }

  return Math.min(needed, max);
}

export function isRoundComplete(
  metadata: DuelRoomMetadata,
  ctx: RoundCompletionContext,
  opts?: { roomStatus?: string }
): boolean {
  if (metadata.phase === "results") return true;
  if (opts?.roomStatus === "finished") return true;

  const needed = resolveResultsNeeded(metadata, ctx);
  return countUniqueResults(metadata.results) >= needed;
}

export function withRoundPhase(
  metadata: DuelRoomMetadata,
  ctx: RoundCompletionContext
): DuelRoomMetadata {
  if (!isRoundComplete(metadata, ctx)) return metadata;
  return { ...metadata, phase: "results" };
}
