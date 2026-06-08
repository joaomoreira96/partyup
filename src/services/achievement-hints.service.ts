import type { AchievementHint } from "@/lib/partyup-sdk/types";
import type { LeaderboardMetric } from "@/types/platform";

/**
 * Game-specific achievement hints are reserved for a future phase (Document C).
 * Platform achievements are evaluated automatically after each session.
 */
export async function processAchievementHints(
  _userId: string,
  _hints: AchievementHint[],
  _ctx: { score: number; metric?: LeaderboardMetric; moduleId?: string }
) {
  return;
}
