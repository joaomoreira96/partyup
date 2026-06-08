import { getGuestName } from "@/lib/guest";
import { clearRoomPlayerId, getRoomPlayerId } from "@/lib/rooms/player-session";
import { normalizeRoomCode } from "@/lib/rooms/codes";

const TRANSITION_KEY = "partyup_room_transition";

/**
 * Marca uma navegação interna entre lobby e jogo da MESMA sala, para que o
 * handler de saída (pagehide/unmount) não remova o jogador da sala.
 */
export function beginRoomTransition(code: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeRoomCode(code);
  if (normalized) sessionStorage.setItem(TRANSITION_KEY, normalized);
}

/** Limpa a marca de transição ao chegar ao destino (lobby ou jogo). */
export function endRoomTransition(code: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeRoomCode(code);
  if (sessionStorage.getItem(TRANSITION_KEY) === normalized) {
    sessionStorage.removeItem(TRANSITION_KEY);
  }
}

function isRoomTransition(normalized: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(TRANSITION_KEY) === normalized;
}

/** Sai da sala (best-effort). Usa keepalive para funcionar ao fechar o separador. */
export function leaveRoomSession(code: string, playerId?: string | null) {
  if (typeof window === "undefined") return;

  const normalized = normalizeRoomCode(code);
  if (!normalized) return;

  // Navegação interna lobby↔jogo da mesma sala: não sair (evita apagar a sala).
  if (isRoomTransition(normalized)) return;

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
