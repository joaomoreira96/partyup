"use client";

import { useCallback, useState } from "react";
import { getGuestName } from "@/lib/guest";
import { clearRoomPlayerId, getRoomPlayerId, saveRoomPlayerId } from "@/lib/rooms/player-session";

type RoomAction =
  | "join"
  | "ready"
  | "unready"
  | "start"
  | "click"
  | "rematch"
  | "leave"
  | "record_stats";

export type RoomStatsRecordInfo = {
  ok: boolean;
  recorded?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
  details?: Array<{
    playerId: string;
    userId: string | null;
    ok: boolean;
    skipped?: boolean;
    error?: string;
  }>;
};

export function useRoom(code: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => getRoomPlayerId(code));

  const runAction = useCallback(
    async (action: RoomAction, extra?: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/rooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            action,
            guestName: getGuestName(),
            playerId: playerId ?? getRoomPlayerId(code),
            ...extra,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          detail?: string;
          playerId?: string;
          playUrl?: string;
          metadata?: unknown;
          result?: {
            playerId: string;
            displayName: string;
            reactionMs: number | null;
            tooEarly: boolean;
            score: number;
          };
          ok?: boolean;
          stats?: RoomStatsRecordInfo | null;
        };

        if (!res.ok) {
          const hint =
            data.detail && data.detail !== data.error ? ` (${data.detail})` : "";
          setError(`${data.error ?? "Não foi possível completar a ação."}${hint}`);
          return { ok: false as const, data };
        }

        if (action === "leave") {
          clearRoomPlayerId(code);
          setPlayerId(null);
        } else if (data.playerId) {
          saveRoomPlayerId(code, data.playerId);
          setPlayerId(data.playerId);
        }

        return { ok: true as const, data };
      } catch {
        setError("Ligação indisponível. Tenta novamente.");
        return { ok: false as const };
      } finally {
        setLoading(false);
      }
    },
    [code, playerId]
  );

  const join = useCallback(() => runAction("join"), [runAction]);
  const ready = useCallback(
    () => runAction("ready", { ready: true }),
    [runAction]
  );
  const unready = useCallback(() => runAction("unready"), [runAction]);
  const start = useCallback(() => runAction("start"), [runAction]);
  const rematch = useCallback(() => runAction("rematch"), [runAction]);
  const leave = useCallback(() => runAction("leave"), [runAction]);
  const click = useCallback(
    (clickedAt: number) => runAction("click", { clickedAt }),
    [runAction]
  );
  const recordStats = useCallback(() => runAction("record_stats"), [runAction]);

  return {
    loading,
    error,
    playerId,
    join,
    ready,
    unready,
    start,
    rematch,
    leave,
    click,
    recordStats,
  };
}
