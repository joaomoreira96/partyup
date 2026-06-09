import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type ResourceType =
  | "ROOM_CREATED"
  | "ROOM_JOINED"
  | "GAME_STARTED"
  | "GAME_SESSION"
  | "SCORE_SUBMITTED"
  | "REALTIME_CONNECTION";

export async function trackResourceUsage(params: {
  userId?: string;
  resourceType: ResourceType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured() || !params.userId) return;

  const supabase = await createClient();
  await supabase.rpc("track_resource_usage", {
    p_user_id: params.userId,
    p_resource_type: params.resourceType,
    p_quantity: params.quantity ?? 1,
    p_metadata: params.metadata ?? {},
  });
}
