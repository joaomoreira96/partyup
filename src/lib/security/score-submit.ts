import { assertNotBanned } from "@/services/ban-check.service";
import { logSecurityEvent } from "@/services/security-event.service";
import { trackResourceUsage } from "@/services/resource-usage.service";
import {
  validateScoreForServer,
  type ServerScoreValidationInput,
} from "@/services/score-validation.service";
import { submitLeaderboardScore } from "@/services/stats.service";
import type { LeaderboardMetric } from "@/types/platform";

export async function processScoreSubmission(params: {
  gameId: string;
  userId: string;
  score: number;
  durationMs: number;
  metric?: LeaderboardMetric;
  moduleId?: string;
  ip?: string | null;
  recordSession?: boolean;
}) {
  const banCheck = await assertNotBanned(params.userId, "score_submit", params.ip);
  if (banCheck.banned) {
    return { ok: false as const, status: 403, message: banCheck.message };
  }

  const validationInput: ServerScoreValidationInput = {
    score: params.score,
    durationMs: params.durationMs,
    metric: params.metric,
    moduleId: params.moduleId,
  };

  const validation = validateScoreForServer(validationInput);

  if (validation.outcome === "hard_reject") {
    await logSecurityEvent({
      eventType: "INVALID_SCORE",
      severity: "high",
      userId: params.userId,
      ipAddress: params.ip ?? undefined,
      metadata: {
        gameId: params.gameId,
        score: params.score,
        durationMs: params.durationMs,
        moduleId: params.moduleId,
        reason: validation.error,
      },
    });
    return {
      ok: false as const,
      status: 422,
      message: "Pontuação não aceite.",
      code: validation.error,
    };
  }

  const leaderboardStatus =
    validation.outcome === "soft_suspicious" ? "pending_review" : "approved";

  if (validation.outcome === "soft_suspicious") {
    await logSecurityEvent({
      eventType: "SUSPICIOUS_SCORE",
      severity: "medium",
      userId: params.userId,
      ipAddress: params.ip ?? undefined,
      metadata: {
        gameId: params.gameId,
        score: params.score,
        durationMs: params.durationMs,
        reason: validation.reviewReason,
      },
    });
  }

  const result = await submitLeaderboardScore({
    gameId: params.gameId,
    userId: params.userId,
    score: params.score,
    metric: params.metric,
    status: leaderboardStatus,
    reviewReason: validation.reviewReason,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      status: result.error === "user_banned" ? 403 : 500,
      message:
        result.error === "user_banned"
          ? "A tua conta está suspensa."
          : "Não foi possível guardar a pontuação.",
    };
  }

  await trackResourceUsage({
    userId: params.userId,
    resourceType: "SCORE_SUBMITTED",
    metadata: {
      gameId: params.gameId,
      score: params.score,
      status: leaderboardStatus,
    },
  });

  return {
    ok: true as const,
    ranked: leaderboardStatus === "approved",
    pendingReview: leaderboardStatus === "pending_review",
  };
}
