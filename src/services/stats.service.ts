import { parseUnlockedAchievements } from "@/lib/achievements/parse-unlocked";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { evaluatePlatformAchievements } from "@/services/achievements.service";
import { logGameEvent } from "@/services/event.service";
import { getMetricForGame } from "@/lib/games/metrics";
import type {
  GameSessionResult,
  LeaderboardMetric,
  ProfileGameSummary,
  ProfileStatsSummary,
  UnlockedAchievement,
  UserStats,
} from "@/types/platform";

export type RecordPlaySessionResult =
  | { ok: false; error: string }
  | { ok: true; skipped?: boolean; unlockedAchievements?: UnlockedAchievement[] };

function normalizeRpcPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof data === "object") return data as Record<string, unknown>;
  return null;
}

export async function recordPlaySession(params: {
  gameId: string;
  userId?: string;
  result: GameSessionResult;
  sessionMetadata?: Record<string, unknown>;
}): Promise<RecordPlaySessionResult> {
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

  const payload = normalizeRpcPayload(rpcData);

  if (!rpcError && payload) {
    if (payload.ok) {
      let unlockedAchievements = parseUnlockedAchievements(
        payload.unlocked_achievements
      );

      // RPC antiga (sem unlocked_achievements) ou avaliação vazia — tentar de novo
      if (
        params.userId &&
        !payload.skipped &&
        unlockedAchievements.length === 0
      ) {
        unlockedAchievements = await evaluatePlatformAchievements(params.userId);
      }

      return {
        ok: true as const,
        skipped: Boolean(payload.skipped),
        unlockedAchievements,
      };
    }
  }

  if (rpcError) {
    console.warn(
      "[recordPlaySession] RPC record_game_session failed, trying direct insert:",
      rpcError.message,
      { gameId: params.gameId, userId: params.userId }
    );
  } else if (!payload?.ok) {
    console.warn("[recordPlaySession] RPC returned unexpected payload:", rpcData);
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

  let unlockedAchievements: UnlockedAchievement[] = [];

  if (params.userId) {
    await upsertUserStatsFallback(params.userId, durationSeconds, score);
    await upsertUserGameStatsFallback(
      params.userId,
      params.gameId,
      durationSeconds,
      score
    );
    unlockedAchievements = await evaluatePlatformAchievements(params.userId);
  }

  return { ok: true as const, unlockedAchievements };
}

function isBetterGameScore(
  metric: LeaderboardMetric,
  current: number,
  candidate: number
): boolean {
  if (candidate <= 0 && metric !== "time") return false;
  if (current <= 0) return candidate > 0;
  return metric === "time" ? candidate < current : candidate > current;
}

async function upsertUserGameStatsFallback(
  userId: string,
  gameId: string,
  durationSeconds: number,
  score: number
) {
  const supabase = await createClient();
  // Schema hosted: games não tem module_id; o módulo vive em game_builds.build_url.
  const { data: build } = await supabase
    .from("game_builds")
    .select("build_url")
    .eq("game_id", gameId)
    .order("is_active", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metric = getMetricForGame(String(build?.build_url ?? "snake"));
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("user_game_stats")
    .select("best_score, sessions_played, play_time_seconds, first_played_at")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("user_game_stats").insert({
      user_id: userId,
      game_id: gameId,
      best_score: score,
      sessions_played: 1,
      play_time_seconds: durationSeconds,
      first_played_at: now,
      last_played_at: now,
      updated_at: now,
    });
    return;
  }

  const bestScore = isBetterGameScore(
    metric,
    Number(existing.best_score ?? 0),
    score
  )
    ? score
    : Number(existing.best_score ?? 0);

  await supabase
    .from("user_game_stats")
    .update({
      best_score: bestScore,
      sessions_played: (existing.sessions_played ?? 0) + 1,
      play_time_seconds: Number(existing.play_time_seconds ?? 0) + durationSeconds,
      last_played_at: now,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("game_id", gameId);
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

  const now = new Date().toISOString();

  if (existing) {
    await supabase
      .from("user_stats")
      .update({
        total_games_played: (existing.total_games_played ?? 0) + 1,
        total_play_time_seconds:
          (existing.total_play_time_seconds ?? 0) + durationSeconds,
        total_score: Number(existing.total_score ?? 0) + score,
        highest_score: Math.max(Number(existing.highest_score ?? 0), score),
        updated_at: now,
        last_played_at: now,
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
  metric?: LeaderboardMetric;
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "offline" };
  }

  // best_score é atualizado no fim da sessão (trigger + record_game_session).
  // Escritas diretas em user_game_stats falham por RLS com a anon key.
  await logGameEvent({
    eventType: "SCORE_SUBMITTED",
    gameId: params.gameId,
    userId: params.userId,
    payload: { score: params.score, metric: params.metric },
  });

  return { ok: true as const };
}

export async function getProfileGames(
  userId: string
): Promise<ProfileGameSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_game_stats")
    .select(
      `game_id, best_score, sessions_played, play_time_seconds, last_played_at,
       games ( name )`
    )
    .eq("user_id", userId)
    .order("last_played_at", { ascending: false });

  if (error || !data) {
    console.error("[getProfileGames] select failed:", error?.message);
    return [];
  }

  return data.map((row) => {
    const gameRaw = row.games as { name: string } | { name: string }[] | null;
    const game = Array.isArray(gameRaw) ? gameRaw[0] : gameRaw;

    return {
      gameId: row.game_id,
      gameName: game?.name ?? "Jogo",
      bestScore: Number(row.best_score ?? 0),
      sessionsPlayed: Number(row.sessions_played ?? 0),
      playTime: Number(row.play_time_seconds ?? 0),
    };
  });
}

function mapUserStatsRow(
  userId: string,
  row: Record<string, unknown>
): UserStats {
  const memberSince =
    (row.member_since as string | undefined) ??
    (row.created_at as string | undefined) ??
    null;

  return {
    user_id: String(row.user_id ?? userId),
    total_games_played: Number(
      row.total_games_played ?? row.games_played ?? 0
    ),
    total_play_time_seconds: Number(row.total_play_time_seconds ?? 0),
    total_score: Number(row.total_score ?? 0),
    highest_score: Number(row.highest_score ?? 0),
    member_since: memberSince,
    last_played_at: (row.last_played_at as string | undefined) ?? null,
  };
}

async function fetchProfileMemberSince(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();

  return data?.created_at ?? null;
}

async function enrichUserStats(
  userId: string,
  stats: UserStats
): Promise<UserStats> {
  if (stats.member_since) return stats;
  const memberSince = await fetchProfileMemberSince(userId);
  return memberSince ? { ...stats, member_since: memberSince } : stats;
}

export function toProfileStatsSummary(stats: UserStats): ProfileStatsSummary {
  return {
    gamesPlayed: stats.total_games_played,
    hoursPlayed: Math.floor(stats.total_play_time_seconds / 3600),
    totalScore: stats.total_score,
    memberSince: stats.member_since ?? null,
  };
}

export async function getProfileStatsSummary(
  userId: string
): Promise<ProfileStatsSummary> {
  const stats = await getUserStats(userId);
  return toProfileStatsSummary(stats);
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
    return enrichUserStats(
      userId,
      mapUserStatsRow(userId, rpcData as Record<string, unknown>)
    );
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
    return enrichUserStats(userId, fallback);
  }

  if (!data) return enrichUserStats(userId, fallback);

  return enrichUserStats(
    userId,
    mapUserStatsRow(userId, data as Record<string, unknown>)
  );
}
