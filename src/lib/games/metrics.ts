import type { LeaderboardMetric } from "@/types/platform";
import { PLATFORM_SCORE_MAX } from "@/lib/games/scoring";

/** Métrica de ranking por módulo — seguro para cliente e servidor */
export function getMetricForGame(_moduleId: string): LeaderboardMetric {
  return "score";
}

export function getMaxScoreForModule(moduleId: string): number {
  switch (moduleId) {
    case "reaction":
    case "memory":
    case "trivia":
    case "reaction-duel":
      return PLATFORM_SCORE_MAX;
    case "snake":
      return 50_000;
    case "click-frenzy":
      return 5_000;
    default:
      return PLATFORM_SCORE_MAX;
  }
}
