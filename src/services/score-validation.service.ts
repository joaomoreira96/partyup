import type { LeaderboardMetric } from "@/types/platform";

export type ServerScoreValidationInput = {
  score: number;
  durationMs: number;
  metric?: LeaderboardMetric;
  moduleId?: string;
};

const MODULE_LIMITS: Record<
  string,
  { maxScore: number; maxDurationMs: number; metric?: LeaderboardMetric }
> = {
  memory: { maxScore: 50_000, maxDurationMs: 600_000, metric: "score" },
  reaction: { maxScore: 30_000, maxDurationMs: 60_000, metric: "time" },
  trivia: { maxScore: 100, maxDurationMs: 600_000, metric: "score" },
  snake: { maxScore: 50_000, maxDurationMs: 3_600_000, metric: "score" },
  "reaction-duel": { maxScore: 1_000, maxDurationMs: 120_000, metric: "score" },
};

export function validateScoreForServer(
  input: ServerScoreValidationInput
): { valid: boolean; error?: string } {
  const { score, durationMs, metric, moduleId } = input;

  if (!Number.isFinite(score) || score < 0) {
    return { valid: false, error: "negative_or_invalid_score" };
  }

  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 3_600_000) {
    return { valid: false, error: "invalid_duration" };
  }

  const limits = moduleId ? MODULE_LIMITS[moduleId] : undefined;
  const effectiveMetric = metric ?? limits?.metric ?? "score";

  if (effectiveMetric === "time") {
    if (score > (limits?.maxScore ?? 120_000)) {
      return { valid: false, error: "impossible_time_score" };
    }
  } else {
    if (score > (limits?.maxScore ?? 10_000_000)) {
      return { valid: false, error: "impossible_score" };
    }
  }

  if (limits && durationMs > limits.maxDurationMs) {
    return { valid: false, error: "duration_exceeded" };
  }

  return { valid: true };
}
