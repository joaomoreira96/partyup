import type { GameRecord, GameStatus, LegacyGameStatus } from "@/types/platform";

/** Normalise DB status (supports legacy published/archived during migration). */
export function normalizeGameStatus(
  status: GameStatus | LegacyGameStatus | string
): GameStatus {
  if (status === "published") return "active";
  if (status === "archived") return "disabled";
  if (status === "draft" || status === "active" || status === "disabled") {
    return status;
  }
  return "draft";
}

export function isPlayableGame(game: Pick<GameRecord, "status">): boolean {
  return normalizeGameStatus(game.status) === "active";
}
