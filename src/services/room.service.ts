import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { generateRoomCode, normalizeRoomCode } from "@/lib/rooms/codes";
import { STATIC_GAMES } from "@/lib/games/catalog";
import { isPlayableGame } from "@/lib/db/mappers";
import type { GameRecord, Room, RoomPlayer } from "@/types/platform";

export { generateRoomCode, normalizeRoomCode };

export async function getRoomByCode(code: string) {
  const normalized = normalizeRoomCode(code);
  if (!normalized || !isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      `id, code, game_id, host_user_id, status, max_players, created_at, updated_at,
       games ( slug, name, module_id, supports_multiplayer )`
    )
    .eq("code", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  return data;
}

export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("room_players")
    .select(
      `id, room_id, user_id, guest_name, is_ready, is_host, joined_at,
       profiles ( display_name, username )`
    )
    .eq("room_id", roomId)
    .order("joined_at");

  if (!data) return [];

  return data.map((row) => {
    const { profiles, ...player } = row as RoomPlayer & {
      profiles: RoomPlayer["profile"] | RoomPlayer["profile"][];
    };
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    return { ...player, profile: profile ?? undefined };
  });
}

export function resolveOfflineRoomGame(slug?: string | null): GameRecord | undefined {
  if (!slug) return undefined;
  const game = STATIC_GAMES.find((g) => g.slug === slug);
  return game && isPlayableGame(game) ? game : undefined;
}

export async function countActiveRooms(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("rooms")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .in("status", ["waiting", "playing"]);
  return count ?? 0;
}

export type RoomWithGame = Room & {
  games?: { slug: string; name: string; module_id: string } | { slug: string }[];
};

export function extractGameSlugFromRoom(room: RoomWithGame): string | undefined {
  if (!room.games) return undefined;
  const g = Array.isArray(room.games) ? room.games[0] : room.games;
  return g && typeof g === "object" && "slug" in g ? g.slug : undefined;
}
