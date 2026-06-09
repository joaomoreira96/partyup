import { PLATFORM_SCORE_MAX } from "@/lib/games/scoring";
import type { LeaderboardMetric } from "@/types/platform";

export type ServerScoreValidationInput = {
  score: number;
  durationMs: number;
  metric?: LeaderboardMetric;
  moduleId?: string;
};

export type ScoreValidationOutcome = "valid" | "hard_reject" | "soft_suspicious";

export type ScoreValidationResult = {
  outcome: ScoreValidationOutcome;
  error?: string;
  reviewReason?: string;
};

type ModuleLimits = {
  maxScore: number;
  maxDurationMs: number;
  metric?: LeaderboardMetric;
  hardMaxScore?: number;
  softMaxScore?: number;
  minReactionMs?: number;
  softMinReactionMs?: number;
  maxClicksPerSecond?: number;
};

const MODULE_LIMITS: Record<string, ModuleLimits> = {
  memory: {
    maxScore: PLATFORM_SCORE_MAX,
    maxDurationMs: 600_000,
    metric: "score",
    softMaxScore: PLATFORM_SCORE_MAX - 5,
  },
  reaction: {
    maxScore: 120_000,
    maxDurationMs: 60_000,
    metric: "time",
    minReactionMs: 10,
    softMinReactionMs: 80,
  },
  trivia: {
    maxScore: PLATFORM_SCORE_MAX,
    maxDurationMs: 600_000,
    metric: "score",
    softMaxScore: PLATFORM_SCORE_MAX - 10,
  },
  snake: {
    maxScore: 50_000,
    maxDurationMs: 3_600_000,
    metric: "score",
    hardMaxScore: 999_999_999,
    softMaxScore: 5_000,
  },
  "reaction-duel": {
    maxScore: PLATFORM_SCORE_MAX,
    maxDurationMs: 120_000,
    metric: "score",
    minReactionMs: 10,
    softMinReactionMs: 90,
  },
  "click-frenzy": {
    maxScore: 5_000,
    maxDurationMs: 120_000,
    metric: "score",
    maxClicksPerSecond: 133,
    softMaxScore: 1_500,
  },
};

function checkHardLimits(
  input: ServerScoreValidationInput,
  limits?: ModuleLimits
): ScoreValidationResult | null {
  const { score, durationMs, metric, moduleId } = input;
  const effectiveMetric = metric ?? limits?.metric ?? "score";

  if (moduleId === "snake" && score > (limits?.hardMaxScore ?? 999_999_999)) {
    return { outcome: "hard_reject", error: "impossible_snake_score" };
  }

  if (
    (moduleId === "reaction" || moduleId === "reaction-duel") &&
    effectiveMetric === "time" &&
    score < (limits?.minReactionMs ?? 10)
  ) {
    return { outcome: "hard_reject", error: "impossible_reaction_time" };
  }

  if (moduleId === "reaction-duel" && score > 0) {
    const reactionMs = Math.max(0, 1000 - score * 4);
    if (reactionMs < (limits?.minReactionMs ?? 10)) {
      return { outcome: "hard_reject", error: "impossible_reaction_time" };
    }
  }

  if (moduleId === "click-frenzy" && durationMs > 0) {
    const clicksPerSecond = score / (durationMs / 1000);
    if (clicksPerSecond > (limits?.maxClicksPerSecond ?? 133)) {
      return { outcome: "hard_reject", error: "impossible_click_rate" };
    }
    if (durationMs <= 15_000 && score > 2000) {
      return { outcome: "hard_reject", error: "impossible_click_frenzy_burst" };
    }
  }

  if (moduleId === "snake" && durationMs > 0 && durationMs < 30_000 && score > 10_000) {
    return { outcome: "hard_reject", error: "impossible_snake_burst" };
  }

  return null;
}

function checkSoftLimits(
  input: ServerScoreValidationInput,
  limits?: ModuleLimits
): ScoreValidationResult | null {
  const { score, durationMs, metric, moduleId } = input;
  const effectiveMetric = metric ?? limits?.metric ?? "score";

  if (limits?.softMaxScore && effectiveMetric !== "time" && score > limits.softMaxScore) {
    return {
      outcome: "soft_suspicious",
      reviewReason: "score_above_typical_range",
    };
  }

  if (
    (moduleId === "reaction" || moduleId === "reaction-duel") &&
    effectiveMetric === "time" &&
    limits?.softMinReactionMs &&
    score > 0 &&
    score < limits.softMinReactionMs
  ) {
    return {
      outcome: "soft_suspicious",
      reviewReason: "reaction_near_human_limit",
    };
  }

  if (moduleId === "reaction-duel" && score > 0) {
    const reactionMs = Math.max(0, 1000 - score * 4);
    if (reactionMs < (limits?.softMinReactionMs ?? 90)) {
      return {
        outcome: "soft_suspicious",
        reviewReason: "duel_reaction_near_human_limit",
      };
    }
  }

  if (moduleId === "click-frenzy" && durationMs > 0) {
    const rate = score / (durationMs / 1000);
    if (rate > 8) {
      return {
        outcome: "soft_suspicious",
        reviewReason: "click_rate_above_average",
      };
    }
  }

  return null;
}

export function validateScoreForServer(
  input: ServerScoreValidationInput
): ScoreValidationResult {
  const { score, durationMs, metric, moduleId } = input;

  if (!Number.isFinite(score) || score < 0) {
    return { outcome: "hard_reject", error: "negative_or_invalid_score" };
  }

  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 3_600_000) {
    return { outcome: "hard_reject", error: "invalid_duration" };
  }

  const limits = moduleId ? MODULE_LIMITS[moduleId] : undefined;
  const effectiveMetric = metric ?? limits?.metric ?? "score";

  const hard = checkHardLimits(input, limits);
  if (hard) return hard;

  if (effectiveMetric === "time") {
    if (score > (limits?.maxScore ?? 120_000)) {
      return { outcome: "hard_reject", error: "impossible_time_score" };
    }
  } else if (score > (limits?.maxScore ?? 10_000_000)) {
    return { outcome: "hard_reject", error: "impossible_score" };
  }

  if (limits && durationMs > limits.maxDurationMs) {
    return { outcome: "hard_reject", error: "duration_exceeded" };
  }

  const soft = checkSoftLimits(input, limits);
  if (soft) return soft;

  return { outcome: "valid" };
}

/** @deprecated Use validateScoreForServer — kept for simple boolean checks */
export function isScoreValid(input: ServerScoreValidationInput): boolean {
  return validateScoreForServer(input).outcome === "valid";
}
