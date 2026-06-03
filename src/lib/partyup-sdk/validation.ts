import type { LeaderboardMetric } from "@/types/platform";
import type { EndGamePayload, SubmitScorePayload } from "@/lib/partyup-sdk/types";

export type ScoreValidationRules = {
  metric?: LeaderboardMetric;
  minScore?: number;
  maxScore?: number;
  maxDurationMs?: number;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; userMessage: string };

export function validateScore(
  score: number,
  rules: ScoreValidationRules = {}
): ValidationResult {
  if (!Number.isFinite(score)) {
    return {
      ok: false,
      reason: "not_finite",
      userMessage: "Pontuação inválida.",
    };
  }

  if (score < 0) {
    return {
      ok: false,
      reason: "negative",
      userMessage: "Pontuação inválida.",
    };
  }

  const min = rules.minScore ?? 0;
  const max = rules.maxScore ?? (rules.metric === "time" ? 300_000 : 10_000_000);

  if (score < min) {
    return {
      ok: false,
      reason: "below_min",
      userMessage: "Pontuação abaixo do mínimo permitido.",
    };
  }

  if (score > max) {
    return {
      ok: false,
      reason: "above_max",
      userMessage: "Pontuação acima do limite permitido.",
    };
  }

  return { ok: true };
}

export function validateEndGamePayload(
  payload: EndGamePayload,
  rules: ScoreValidationRules = {}
): ValidationResult {
  const scoreCheck = validateScore(payload.score, rules);
  if (!scoreCheck.ok) return scoreCheck;

  if (!Number.isFinite(payload.durationMs) || payload.durationMs < 0) {
    return {
      ok: false,
      reason: "invalid_duration",
      userMessage: "Duração de jogo inválida.",
    };
  }

  const maxDuration = rules.maxDurationMs ?? 3_600_000;
  if (payload.durationMs > maxDuration) {
    return {
      ok: false,
      reason: "duration_too_long",
      userMessage: "Sessão demasiado longa para ser registada.",
    };
  }

  return { ok: true };
}

export function validateSubmitScorePayload(
  payload: SubmitScorePayload,
  rules: ScoreValidationRules = {}
): ValidationResult {
  return validateScore(payload.score, {
    ...rules,
    metric: payload.metric ?? rules.metric,
  });
}
