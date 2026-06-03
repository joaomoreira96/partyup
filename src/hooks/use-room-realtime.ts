"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { RoomPlayer } from "@/types/platform";

/**
 * Subscribes to room_players changes via Supabase Realtime (Document 03).
 */
export function useRoomRealtime(roomId: string | null) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  useEffect(() => {
    if (!roomId || !isSupabaseConfigured()) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("room_players")
            .select(
              `id, room_id, user_id, guest_name, is_ready, is_host, joined_at,
               profiles ( display_name, username )`
            )
            .eq("room_id", roomId)
            .order("joined_at");

          if (data) {
            setPlayers(
              data.map((row) => {
                const { profiles, ...p } = row as RoomPlayer & {
                  profiles: RoomPlayer["profile"] | RoomPlayer["profile"][];
                };
                const profile = Array.isArray(profiles) ? profiles[0] : profiles;
                return { ...p, profile: profile ?? undefined };
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return players;
}
