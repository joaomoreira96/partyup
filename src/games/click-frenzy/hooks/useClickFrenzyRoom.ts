"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deriveClickFrenzyPhase,
  parseClickFrenzyMetadata,
  type ClickFrenzyMetadata,
  type ClickFrenzyPhase,
} from "@/lib/rooms/click-frenzy-state";
import { mergePlayerLists, mergePlayerRow } from "@/lib/rooms/normalize-player";
import type { RoomPlayer } from "@/types/platform";
import { useI18n } from "@/features/i18n/locale-provider";

const MAX_PLAYERS_FALLBACK = 8;
const PHASE_TICK_MS = 100;

type ClickFrenzyRoomState = {
  roomId: string | null;
  status: string;
  hostUserId: string | null;
  maxPlayers: number;
  metadata: ClickFrenzyMetadata;
  players: RoomPlayer[];
};

export function useClickFrenzyRoom(roomCode: string) {
  const { t } = useI18n();
  const [state, setState] = useState<ClickFrenzyRoomState>(() => ({
    roomId: null,
    status: "waiting",
    hostUserId: null,
    maxPlayers: MAX_PLAYERS_FALLBACK,
    metadata: parseClickFrenzyMetadata(null),
    players: [],
  }));
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const roomIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(roomCode)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(body.detail ?? body.error ?? t("clickFrenzy.roomNotFound"));
        return;
      }
      const data = (await res.json()) as {
        room: {
          id: string;
          status: string;
          hostUserId?: string | null;
          maxPlayers?: number;
          metadata: unknown;
        };
        players: RoomPlayer[];
      };

      setState((prev) => ({
        roomId: data.room.id,
        status: data.room.status,
        hostUserId: data.room.hostUserId ?? null,
        maxPlayers: data.room.maxPlayers ?? MAX_PLAYERS_FALLBACK,
        metadata: parseClickFrenzyMetadata(data.room.metadata),
        players: mergePlayerLists(data.players, prev.players),
      }));
      setError(null);
    } catch {
      setError(t("clickFrenzy.connectionUnavailable"));
    }
  }, [roomCode, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    roomIdRef.current = state.roomId;
  }, [state.roomId]);

  useEffect(() => {
    if (!state.roomId || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const roomId = state.roomId;

    const channel = supabase
      .channel(`click-frenzy:${roomId}`)
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
          // Novo jogador: refrescar para obter o nome (profile) enriquecido.
          if (payload.eventType === "INSERT") {
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
          const row = payload.new as { metadata?: unknown; status?: string };
          if (!row) return;
          setState((prev) => ({
            ...prev,
            status: row.status ?? prev.status,
            metadata: parseClickFrenzyMetadata(row.metadata),
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state.roomId, refresh]);

  // Relógio local para derivar a fase (countdown/playing/results) a partir dos timestamps.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), PHASE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const phase: ClickFrenzyPhase = deriveClickFrenzyPhase(state.metadata, now);

  const patchMetadata = useCallback((raw: unknown, status?: string) => {
    setState((prev) => ({
      ...prev,
      status: status ?? prev.status,
      metadata: parseClickFrenzyMetadata(raw),
    }));
  }, []);

  return { ...state, phase, now, error, refresh, patchMetadata };
}
