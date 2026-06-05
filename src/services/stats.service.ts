import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { logGameEvent } from "@/services/event.service";
import type { GameSessionResult, UserStats } from "@/types/platform";

export async function recordPlaySession(params: {
  gameId: string;
  userId?: string;
  result: GameSessionResult;
  sessionMetadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "offline" };

  const supabase = await createClient();
  const durationSeconds = Math.max(1, Math.round(params.result.durationMs / 1000));
  const score = Math.max(0, Math.round(params.result.score));
  const metadata = params.sessionMetadata ?? {};

  const { data: rpcData, error: rpcError } = await supabase.rpc("record_game_session", {
    p_game_id: params.gameId,
    p_user_id: params.userId ?? null,
    p_duration_seconds: durationSeconds,
    p_score: score,
    p_metadata: metadata,
  });

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const payload = rpcData as { ok?: boolean; skipped?: boolean };
    if (payload.ok) return { ok: true as const, skipped: Boolean(payload.skipped) };
  }

  if (rpcError) {
    console.warn(
      "[recordPlaySession] RPC record_game_session failed, trying direct insert:",
      rpcError.message
    );
  }

  const row: Record<string, unknown> = {
    game_id: params.gameId,
    user_id: params.userId ?? null,
    duration_seconds: durationSeconds,
    score,
    ended_at: new Date().toISOString(),
  };

  let { error } = await supabase.from("game_sessions").insert({
    ...row,
    metadata,
  });

  if (error?.message?.includes("metadata")) {
    ({ error } = await supabase.from("game_sessions").insert(row));
  }

  if (error) {
    console.error("[recordPlaySession] game_sessions insert failed:", error.message);
    return { ok: false as const, error: error.message };
  }

  if (params.userId) {
    await upsertUserStatsFallback(params.userId, durationSeconds, score);
  }

  return { ok: true as const };
}

async function upsertUserStatsFallback(
  userId: string,
  durationSeconds: number,
  score: number
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_stats")
    .select("total_games_played, total_play_time_seconds, total_score, highest_score")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_stats")
      .update({
        total_games_played: (existing.total_games_played ?? 0) + 1,
        total_play_time_seconds:
          (existing.total_play_time_seconds ?? 0) + durationSeconds,
        total_score: Number(existing.total_score ?? 0) + score,
        highest_score: Math.max(Number(existing.highest_score ?? 0), score),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return;
  }

  await supabase.from("user_stats").insert({
    user_id: userId,
    total_games_played: 1,
    total_play_time_seconds: durationSeconds,
    total_score: score,
    highest_score: score,
  });
}

export async function recordDuelRoomSessions(params: {
  gameId: string;
  roomId: string;
  metadata: {
    roundId: string;
    countdownStartAt: number | null;
    greenAt: number | null;
    results: Array<{
      playerId: string;
      reactionMs: number | null;
      score: number;
    }>;
  };
  players: Array<{ id: string; user_id: string | null }>;
}) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "offline" };

  const { roundId, countdownStartAt, greenAt, results } = params.metadata;

  const baseMs =
    countdownStartAt && greenAt ? Math.max(greenAt - countdownStartAt, 0) : 0;
  const maxReaction = Math.max(0, ...results.map((r) => r.reactionMs ?? 0));
  // Ronda completa: sync + countdown + vermelho + reacção (mín. ~15s se sem timestamps)
  const durationMs =
    baseMs > 0
      ? Math.max(baseMs + maxReaction, 5000)
      : Math.max(maxReaction, 15_000);

  const errors: string[] = [];
  const details: Array<{
    playerId: string;
    userId: string | null;
    ok: boolean;
    skipped?: boolean;
    error?: string;
  }> = [];
  let recorded = 0;

  for (const result of results) {
    const player = params.players.find((p) => p.id === result.playerId);
    const userId = player?.user_id ?? null;

    const sessionResult = await recordPlaySession({
      gameId: params.gameId,
      userId: userId ?? undefined,
      result: { score: result.score, durationMs },
      sessionMetadata: {
        source: "reaction-duel",
        roundId,
        roomId: params.roomId,
        playerId: result.playerId,
        reactionMs: result.reactionMs,
      },
    });

    details.push({
      playerId: result.playerId,
      userId,
      ok: sessionResult.ok,
      skipped: sessionResult.ok ? sessionResult.skipped : undefined,
      error: sessionResult.ok ? undefined : sessionResult.error,
    });

    if (!sessionResult.ok) {
      errors.push(
        `${result.playerId}${userId ? ` (user ${userId})` : " (guest)"}: ${sessionResult.error ?? "unknown"}`
      );
      continue;
    }

    recorded += sessionResult.skipped ? 0 : 1;

    if (userId && result.score > 0) {
      await submitLeaderboardScore({
        gameId: params.gameId,
        userId,
        score: result.score,
        metric: "score",
      });
    }
  }

  if (errors.length > 0) {
    console.error("[recordDuelRoomSessions] failures:", errors.join("; "));
    return { ok: false as const, error: errors.join("; "), recorded, details };
  }

  return { ok: true as const, recorded, details };
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
  const row: Record<string, unknown> = {
    game_id: params.gameId,
    user_id: params.userId,
    score: params.score,
  };

  const { error } = await supabase.from("leaderboards").insert(row);

  if (error) return { ok: false as const, error: error.message };

  await logGameEvent({
    eventType: "SCORE_SUBMITTED",
    gameId: params.gameId,
    userId: params.userId,
    payload: { score: params.score, metric: params.metric },
  });

  return { ok: true as const };
}

function mapUserStatsRow(
  userId: string,
  row: Record<string, unknown>
): UserStats {
  return {
    user_id: String(row.user_id ?? userId),
    total_games_played: Number(
      row.total_games_played ?? row.games_played ?? 0
    ),
    total_play_time_seconds: Number(row.total_play_time_seconds ?? 0),
    total_score: Number(row.total_score ?? 0),
    highest_score: Number(row.highest_score ?? 0),
  };
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

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_stats", {
    p_user_id: userId,
  });

  if (!rpcError && rpcData && typeof rpcData === "object") {
    return mapUserStatsRow(userId, rpcData as Record<string, unknown>);
  }

  if (rpcError) {
    console.warn("[getUserStats] RPC failed, trying direct select:", rpcError.message);
  }

  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getUserStats] select failed:", error.message);
    return fallback;
  }

  if (!data) return fallback;

  return mapUserStatsRow(userId, data as Record<string, unknown>);
}
