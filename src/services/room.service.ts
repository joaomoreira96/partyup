import { createClient } from "@/lib/supabase/server";

import { isSupabaseConfigured } from "@/lib/supabase/client";

import { generateRoomCode, normalizeRoomCode } from "@/lib/rooms/codes";

import { STATIC_GAMES } from "@/lib/games/catalog";

import { isPlayableGame } from "@/lib/db/mappers";

import type { GameRecord, Room, RoomPlayer } from "@/types/platform";



export { generateRoomCode, normalizeRoomCode };



export type RoomRow = Room & {

  metadata?: unknown;

  games?:

    | { slug: string; name?: string; module_id?: string; is_multiplayer?: boolean }

    | { slug: string }[];

};



function mapRpcRoom(data: Record<string, unknown>): RoomRow {

  const host =

    (data.host_user_id as string | null | undefined) ??

    (data.host_id as string | null | undefined) ??

    null;



  return {

    id: data.id as string,

    code: data.code as string,

    game_id: data.game_id as string,

    host_user_id: host,

    status: data.status as Room["status"],

    max_players: (data.max_players as number | undefined) ?? 2,

    created_at: (data.created_at as string) ?? new Date().toISOString(),

    metadata: data.metadata,

  };

}



async function attachGameSlug(

  supabase: Awaited<ReturnType<typeof createClient>>,

  room: RoomRow

): Promise<RoomRow> {

  if (extractGameSlugFromRoom(room)) return room;



  const { data: game } = await supabase

    .from("games")

    .select("slug, name, is_multiplayer")

    .eq("id", room.game_id)

    .maybeSingle();



  if (!game) return room;

  return { ...room, games: game };

}



async function fetchRoomDirect(code: string): Promise<RoomRow | null> {

  const supabase = await createClient();

  const selectAttempts = [

    "id, code, game_id, status, host_user_id, metadata, max_players",

    "id, code, game_id, status, host_id, max_players",

    "id, code, game_id, status",

  ];



  for (const columns of selectAttempts) {

    const { data, error } = await supabase

      .from("rooms")

      .select(columns)

      .eq("code", code)

      .maybeSingle();



    if (error || !data) continue;



    const row = data as unknown as Record<string, unknown>;

    const mapped = mapRpcRoom(row);

    if (row.host_id && !mapped.host_user_id) {

      mapped.host_user_id = row.host_id as string | null;

    }

    return mapped;

  }



  return null;

}



export async function getRoomByCode(code: string): Promise<RoomRow | null> {

  const normalized = normalizeRoomCode(code);

  if (!normalized || !isSupabaseConfigured()) return null;



  const supabase = await createClient();



  const { data: rpcData, error: rpcError } = await supabase.rpc("get_room_by_code", {

    p_code: normalized,

  });



  if (!rpcError && rpcData && typeof rpcData === "object") {

    const room = mapRpcRoom(rpcData as Record<string, unknown>);

    return attachGameSlug(supabase, room);

  }



  const direct = await fetchRoomDirect(normalized);

  if (!direct) return null;

  return attachGameSlug(supabase, direct);

}



export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {

  if (!isSupabaseConfigured()) return [];



  const supabase = await createClient();

  const { data } = await supabase

    .from("room_players")

    .select(`*, profiles ( display_name, username )`)

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



async function cleanupStaleRoomPresence(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("expire_inactive_rooms", { p_idle_minutes: 30 }).then(
    () => undefined,
    () => undefined
  );
  await supabase.rpc("cleanup_stale_room_presence", { p_max_idle_minutes: 10 });
}

function parseCountValue(data: unknown): number | null {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string" && data.trim() !== "") {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function countActiveRooms(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();

  await cleanupStaleRoomPresence();

  const { data, error } = await supabase.rpc("count_occupied_rooms");
  const parsed = !error ? parseCountValue(data) : null;
  if (parsed !== null) return parsed;

  const { data: rows, error: selectError } = await supabase
    .from("rooms")
    .select("id, status, room_players!inner(id)")
    .not("status", "eq", "finished");

  if (selectError || !rows) return 0;
  return new Set(rows.map((row) => row.id as string)).size;
}



export type RoomWithGame = RoomRow;



export function extractGameSlugFromRoom(room: RoomWithGame): string | undefined {

  if (!room.games) return undefined;

  const g = Array.isArray(room.games) ? room.games[0] : room.games;

  return g && typeof g === "object" && "slug" in g ? g.slug : undefined;

}


