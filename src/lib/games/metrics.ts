import type { LeaderboardMetric } from "@/types/platform";

/** Métrica de ranking por módulo — seguro para cliente e servidor */
export function getMetricForGame(moduleId: string): LeaderboardMetric {
  return moduleId === "reaction" ? "time" : "score";
}

export function getMaxScoreForModule(moduleId: string): number {
  switch (moduleId) {
    case "reaction":
      return 120_000;
    case "trivia":
      return 100;
    case "memory":
      return 50_000;
    case "snake":
      return 50_000;
    case "reaction-duel":
      return 250;
    case "click-frenzy":
      return 5_000;
    default:
      return 100_000;
  }
}
