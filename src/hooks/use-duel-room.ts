"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  DUEL_TICK_MS,
  parseDuelMetadata,
  phaseFromTimestamps,
  type DuelRoomMetadata,
} from "@/lib/rooms/duel-state";
import { withRoundPhase } from "@/lib/rooms/round-completion";
import {
  clearDuelMetadataCache,
  loadDuelMetadataCache,
  saveDuelMetadataCache,
} from "@/lib/rooms/duel-meta-cache";
import { mergePlayerLists, mergePlayerRow } from "@/lib/rooms/normalize-player";
import type { RoomPlayer } from "@/types/platform";

type DuelRoomState = {
  roomId: string | null;
  status: string;
  hostUserId: string | null;
  maxPlayers: number;
  metadata: DuelRoomMetadata;
  players: RoomPlayer[];
  phase: ReturnType<typeof phaseFromTimestamps>;
};

const EMPTY_METADATA: DuelRoomMetadata = {
  phase: "lobby",
  roundId: "",
  countdownStartAt: null,
  greenAt: null,
  winnerPlayerId: null,
  results: [],
};

function initialMetadata(roomCode: string): DuelRoomMetadata {
  return loadDuelMetadataCache(roomCode) ?? EMPTY_METADATA;
}

function applyMetadata(
  metadata: DuelRoomMetadata,
  roomCode: string,
  playerCount: number,
  maxPlayers: number
): Pick<DuelRoomState, "metadata" | "phase"> {
  const ctx = { playerCount, maxPlayers };
  const normalized = withRoundPhase(metadata, ctx);
  saveDuelMetadataCache(roomCode, normalized);
  return {
    metadata: normalized,
    phase: phaseFromTimestamps(normalized, Date.now(), ctx),
  };
}

export function useDuelRoom(roomCode: string) {
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const [state, setState] = useState<DuelRoomState>(() => {
    const metadata = initialMetadata(roomCode);
    return {
      roomId: null,
      status: "waiting",
      hostUserId: null,
      maxPlayers: 2,
      metadata,
      players: [],
      phase: phaseFromTimestamps(metadata),
    };
  });
  const [error, setError] = useState<string | null>(null);

  const patchMetadata = useCallback(
    (raw: unknown, status?: string) => {
      setState((prev) => {
        const metadata = parseDuelMetadata(raw);
        const applied = applyMetadata(
          metadata,
          roomCode,
          prev.players.length,
          prev.maxPlayers
        );
        return {
          ...prev,
          ...applied,
          status:
            status ??
            (applied.metadata.phase === "results" ? "finished" : prev.status),
        };
      });
    },
    [roomCode]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(roomCode)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(body.detail ?? body.error ?? "Sala não encontrada.");
        return;
      }
      const data = (await res.json()) as {
        room: {
          id: string;
          status: string;
          hostUserId?: string | null;
          maxPlayers?: number;
          metadata: DuelRoomMetadata;
        };
        players: RoomPlayer[];
      };

      setState((prev) => {
        const maxPlayers = data.room.maxPlayers ?? 2;
        const players = mergePlayerLists(data.players, prev.players);
        const metadata = data.room.metadata ?? EMPTY_METADATA;
        const applied = applyMetadata(metadata, roomCode, players.length, maxPlayers);
        return {
          roomId: data.room.id,
          status: data.room.status,
          hostUserId: data.room.hostUserId ?? null,
          maxPlayers,
          ...applied,
          players,
        };
      });
      setError(null);
    } catch {
      setError("Ligação indisponível.");
    }
  }, [roomCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!state.roomId || !isSupabaseConfigured()) return;

    const supabase = createClient();
    const roomId = state.roomId;

    const channel = supabase
      .channel(`duel:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (payload.eventType === "DELETE" || !row?.id) {
            void refresh();
            return;
          }
          setState((prev) => ({
            ...prev,
            players: mergePlayerRow(prev.players, row),
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            metadata?: unknown;
            status?: string;
          };
          if (!row) return;

          const code = roomCodeRef.current;
          const metadata = parseDuelMetadata(row.metadata);
          const backToLobby =
            (metadata.phase === "lobby" && !metadata.countdownStartAt) ||
            row.status === "waiting";
          if (backToLobby) {
            clearDuelMetadataCache(code);
          }
          setState((prev) => {
            const applied = applyMetadata(
              metadata,
              code,
              prev.players.length,
              prev.maxPlayers
            );
            return {
              ...prev,
              status: row.status ?? prev.status,
              ...applied,
            };
          });
        }
      )
      .subscribe();

    const tick = window.setInterval(() => {
      setState((prev) => {
        const ctx = { playerCount: prev.players.length, maxPlayers: prev.maxPlayers };
        const metadata = withRoundPhase(prev.metadata, ctx);
        return {
          ...prev,
          metadata,
          phase: phaseFromTimestamps(metadata, Date.now(), ctx),
        };
      });
    }, DUEL_TICK_MS);

    return () => {
      window.clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [state.roomId, refresh]);

  return { ...state, error, refresh, patchMetadata };
}
