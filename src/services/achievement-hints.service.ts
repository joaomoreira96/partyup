import type { AchievementHint } from "@/lib/partyup-sdk/types";
import type { LeaderboardMetric } from "@/types/platform";
import { unlockAchievement } from "@/services/achievements.service";

const HINT_MAP: Record<
  AchievementHint,
  { slug: string; validate?: (ctx: HintContext) => boolean }
> = {
  FIRST_WIN: { slug: "first_win" },
  PERFECT_SCORE: {
    slug: "first_win",
    validate: (ctx) => ctx.metric === "score" && ctx.score >= ctx.perfectThreshold,
  },
  SPEED_RUN: {
    slug: "top_10",
    validate: (ctx) => ctx.metric === "time" && ctx.score < 500,
  },
  GAMES_100: { slug: "games_100" },
};

type HintContext = {
  score: number;
  metric?: LeaderboardMetric;
  perfectThreshold: number;
};

export async function processAchievementHints(
  userId: string,
  hints: AchievementHint[],
  ctx: { score: number; metric?: LeaderboardMetric; moduleId?: string }
) {
  const context: HintContext = {
    score: ctx.score,
    metric: ctx.metric,
    perfectThreshold: ctx.moduleId === "trivia" ? 5 : 10_000,
  };

  for (const hint of hints) {
    const rule = HINT_MAP[hint];
    if (!rule) continue;
    if (rule.validate && !rule.validate(context)) continue;
    await unlockAchievement(userId, rule.slug);
  }
}
