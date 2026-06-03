import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { GameEventType } from "@/types/platform";

export async function logGameEvent(params: {
  eventType: GameEventType;
  gameId?: string;
  userId?: string;
  roomId?: string;
  payload?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase.from("game_events").insert({
    event_type: params.eventType,
    game_id: params.gameId ?? null,
    user_id: params.userId ?? null,
    room_id: params.roomId ?? null,
    payload: params.payload ?? {},
  });
}
