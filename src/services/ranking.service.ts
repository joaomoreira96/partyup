import { getMetricForGame } from "@/lib/games/metrics";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getPublishedGames } from "@/services/game.service";

export { getMetricForGame } from "@/lib/games/metrics";
import type {
  GameRecord,
  LeaderboardEntry,
  LeaderboardMetric,
} from "@/types/platform";

function normalizeProfile(
  profilesRaw: LeaderboardEntry["profile"] | LeaderboardEntry["profile"][]
) {
  return Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw;
}

export async function getGameLeaderboard(
  gameId: string,
  metric: LeaderboardMetric = "score",
  limit = 20
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const ascending = metric === "time";

  const { data, error } = await supabase
    .from("leaderboards")
    .select(
      `id, game_id, user_id, score, metric, created_at,
       profiles ( display_name, username, avatar_url )`
    )
    .eq("game_id", gameId)
    .eq("metric", metric)
    .order("score", { ascending })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const { profiles: profilesRaw, ...entry } = row as LeaderboardEntry & {
      profiles: LeaderboardEntry["profile"] | LeaderboardEntry["profile"][];
    };
    return {
      ...entry,
      score: Number(entry.score),
      profile: normalizeProfile(profilesRaw) ?? undefined,
    };
  });
}

export type RankingPreview = {
  game: Pick<GameRecord, "slug" | "name" | "thumbnail_url" | "module_id">;
  topEntry: LeaderboardEntry | null;
  metric: LeaderboardMetric;
};

export async function getGlobalRankingsPreview(
  limitPerGame = 1
): Promise<RankingPreview[]> {
  const games = await getPublishedGames();
  const previews: RankingPreview[] = [];

  for (const game of games.slice(0, 4)) {
    const metric = getMetricForGame(game.module_id);
    const entries = await getGameLeaderboard(game.id, metric, limitPerGame);
    previews.push({
      game: {
        slug: game.slug,
        name: game.name,
        thumbnail_url: game.thumbnail_url,
        module_id: game.module_id,
      },
      topEntry: entries[0] ?? null,
      metric,
    });
  }

  return previews;
}
