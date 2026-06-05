const KEY_PREFIX = "partyup_room_player:";

export function saveRoomPlayerId(roomCode: string, playerId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${KEY_PREFIX}${roomCode.toUpperCase()}`, playerId);
}

export function getRoomPlayerId(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${KEY_PREFIX}${roomCode.toUpperCase()}`);
}

export function clearRoomPlayerId(roomCode: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${KEY_PREFIX}${roomCode.toUpperCase()}`);
}
