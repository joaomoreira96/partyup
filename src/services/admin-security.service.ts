import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isAdmin } from "@/services/auth.service";

export type SecurityOverview = {
  eventsLast24h: number;
  rateLimitsLast24h: number;
  rejectedScoresLast24h: number;
  pendingReviews: number;
  flaggedUsers: number;
  activeBans: number;
  recentRevocations: number;
};

export type ScoreReviewRow = {
  id: string;
  userId: string;
  gameId: string;
  score: number;
  status: string;
  reviewReason: string | null;
  achievedAt: string;
  displayName: string | null;
  username: string | null;
  gameName: string | null;
  gameSlug: string | null;
};

export type FlaggedUserRow = {
  id: string;
  userId: string;
  reason: string;
  severity: string;
  createdAt: string;
  displayName: string | null;
  username: string | null;
};

export async function getSecurityOverview(): Promise<SecurityOverview | null> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return null;

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    eventsRes,
    rateRes,
    rejectedRes,
    pendingRes,
    flagsRes,
    bansRes,
    revokedRes,
  ] = await Promise.all([
    supabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "RATE_LIMIT_HIT")
      .gte("created_at", since),
    supabase
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["INVALID_SCORE", "SCORE_REJECTED", "SCORE_REJECTED_ADMIN"])
      .gte("created_at", since),
    supabase
      .from("leaderboards")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("user_flags")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("user_bans")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null),
    supabase
      .from("user_bans")
      .select("id", { count: "exact", head: true })
      .not("revoked_at", "is", null)
      .gte("revoked_at", since),
  ]);

  return {
    eventsLast24h: eventsRes.count ?? 0,
    rateLimitsLast24h: rateRes.count ?? 0,
    rejectedScoresLast24h: rejectedRes.count ?? 0,
    pendingReviews: pendingRes.count ?? 0,
    flaggedUsers: flagsRes.count ?? 0,
    activeBans: bansRes.count ?? 0,
    recentRevocations: revokedRes.count ?? 0,
  };
}

export async function listScoreReviews(limit = 50): Promise<ScoreReviewRow[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaderboards")
    .select(
      `id, user_id, game_id, score, status, review_reason, achieved_at,
       profiles ( display_name, username ),
       games ( name, slug )`
    )
    .in("status", ["pending_review", "rejected"])
    .order("achieved_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const profileRaw = row.profiles as
      | { display_name: string | null; username: string | null }
      | { display_name: string | null; username: string | null }[]
      | null;
    const gameRaw = row.games as
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const game = Array.isArray(gameRaw) ? gameRaw[0] : gameRaw;

    return {
      id: row.id as string,
      userId: row.user_id as string,
      gameId: row.game_id as string,
      score: Number(row.score),
      status: row.status as string,
      reviewReason: (row.review_reason as string | null) ?? null,
      achievedAt: row.achieved_at as string,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
      gameName: game?.name ?? null,
      gameSlug: game?.slug ?? null,
    };
  });
}

export async function listFlaggedUsers(limit = 30): Promise<FlaggedUserRow[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_flags")
    .select(
      `id, user_id, reason, severity, created_at,
       profiles ( display_name, username )`
    )
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const profileRaw = row.profiles as
      | { display_name: string | null; username: string | null }
      | { display_name: string | null; username: string | null }[]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

    return {
      id: row.id as string,
      userId: row.user_id as string,
      reason: row.reason as string,
      severity: row.severity as string,
      createdAt: row.created_at as string,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
    };
  });
}

export async function reviewLeaderboardScore(
  leaderboardId: string,
  action: "approve" | "reject",
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_leaderboard_score", {
    p_leaderboard_id: leaderboardId,
    p_action: action,
    p_reason: reason ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function createUserFlag(
  userId: string,
  reason: string,
  severity: "low" | "medium" | "high" | "critical" = "medium"
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_user_flag", {
    p_user_id: userId,
    p_reason: reason,
    p_severity: severity,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveUserFlag(
  flagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resolve_user_flag", {
    p_flag_id: flagId,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}
