import type { RoomPlayer } from "@/types/platform";

export function getHostPlayer(
  players: RoomPlayer[],
  hostUserId?: string | null
): RoomPlayer | undefined {
  if (hostUserId) {
    const match = players.find((p) => p.user_id === hostUserId);
    if (match) return match;
  }

  const flagged = players.find((p) => p.is_host);
  if (flagged) return flagged;

  return [...players].sort((a, b) =>
    a.joined_at.localeCompare(b.joined_at)
  )[0];
}

export function isLocalHost(
  localPlayerId: string | null | undefined,
  players: RoomPlayer[],
  hostUserId?: string | null
): boolean {
  if (!localPlayerId) return false;
  return getHostPlayer(players, hostUserId)?.id === localPlayerId;
}

export function playersAllReady(players: RoomPlayer[]): boolean {
  if (players.length === 0) return false;
  return players.every((p) => p.is_ready === true);
}

export function countReadyPlayers(players: RoomPlayer[]): number {
  return players.filter((p) => p.is_ready === true).length;
}
