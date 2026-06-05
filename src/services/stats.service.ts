import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { logGameEvent } from "@/services/event.service";
import type { GameSessionResult, UserStats } from "@/types/platform";

export async function recordPlaySession(params: {
  gameId: string;
  userId?: string;
  guestId?: string;
  result: GameSessionResult;
}) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const durationSeconds = Math.max(0, Math.round(params.result.durationMs / 1000));

  const { error } = await supabase.from("game_sessions").insert({
    game_id: params.gameId,
    user_id: params.userId ?? null,
    guest_id: params.guestId ?? null,
    duration_seconds: durationSeconds,
    score: params.result.score,
    ended_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[recordPlaySession] game_sessions insert failed:", error.message);
    return;
  }

  // user_stats e game_stats são atualizados pelo trigger apply_session_stats na BD.
}

export async function submitLeaderboardScore(params: {
  gameId: string;
  userId: string;
  score: number;
  metric?: "score" | "time" | "streak";
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "offline" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leaderboards").insert({
    game_id: params.gameId,
    user_id: params.userId,
    score: params.score,
    metric: params.metric ?? "score",
  });

  if (error) return { ok: false as const, error: error.message };

  await logGameEvent({
    eventType: "SCORE_SUBMITTED",
    gameId: params.gameId,
    userId: params.userId,
    payload: { score: params.score, metric: params.metric },
  });

  return { ok: true as const };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const fallback: UserStats = {
    user_id: userId,
    total_games_played: 0,
    total_play_time_seconds: 0,
    total_score: 0,
    highest_score: 0,
  };

  if (!isSupabaseConfigured()) return fallback;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return fallback;

  return {
    user_id: data.user_id,
    total_games_played:
      data.total_games_played ?? data.games_played ?? 0,
    total_play_time_seconds: data.total_play_time_seconds ?? 0,
    total_score: Number(data.total_score ?? 0),
    highest_score: Number(data.highest_score ?? 0),
  };
}
