import { getGuestName } from "@/lib/guest";
import { clearRoomPlayerId, getRoomPlayerId } from "@/lib/rooms/player-session";
import { normalizeRoomCode } from "@/lib/rooms/codes";

/** Sai da sala (best-effort). Usa keepalive para funcionar ao fechar o separador. */
export function leaveRoomSession(code: string, playerId?: string | null) {
  if (typeof window === "undefined") return;

  const normalized = normalizeRoomCode(code);
  if (!normalized) return;

  const resolvedPlayerId = playerId ?? getRoomPlayerId(normalized);
  clearRoomPlayerId(normalized);

  const body = JSON.stringify({
    code: normalized,
    action: "leave",
    guestName: getGuestName(),
    playerId: resolvedPlayerId,
  });

  void fetch("/api/rooms", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
