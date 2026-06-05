import {
  parseDuelMetadata,
  type DuelRoomMetadata,
} from "@/lib/rooms/duel-state";

const KEY_PREFIX = "partyup_duel_meta:";

export function saveDuelMetadataCache(
  roomCode: string,
  metadata: DuelRoomMetadata
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `${KEY_PREFIX}${roomCode.toUpperCase()}`,
    JSON.stringify(metadata)
  );
}

export function loadDuelMetadataCache(roomCode: string): DuelRoomMetadata | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${KEY_PREFIX}${roomCode.toUpperCase()}`);
  if (!raw) return null;
  try {
    return parseDuelMetadata(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function clearDuelMetadataCache(roomCode: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${KEY_PREFIX}${roomCode.toUpperCase()}`);
}
