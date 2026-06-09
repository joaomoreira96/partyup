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
      `id, user_id, game_id, score, achieved_at,
       profiles ( display_name, username, avatar_url, is_banned, banned_until )`
    )
    .eq("game_id", gameId)
    .eq("status", "approved")
    .gt("score", 0)
    .order("score", { ascending })
    .limit(limit * 2);

  if (error || !data) return [];

  const entries: LeaderboardEntry[] = [];

  for (const row of data) {
    type ProfileRow = LeaderboardEntry["profile"] & {
      is_banned?: boolean;
      banned_until?: string | null;
    };
    const profilesRaw = row.profiles as ProfileRow | ProfileRow[] | null | undefined;
    if (!profilesRaw) continue;
    const profile = normalizeProfile(profilesRaw);
    if (!profile) continue;

    const banRow = profile as ProfileRow;
    if (
      banRow.is_banned &&
      (!banRow.banned_until || new Date(banRow.banned_until) > new Date())
    ) {
      continue;
    }

    entries.push({
      id: row.id as string,
      game_id: row.game_id as string,
      user_id: row.user_id as string,
      score: Number(row.score),
      metric,
      created_at: (row.achieved_at as string) ?? new Date().toISOString(),
      profile: profile ?? undefined,
    });

    if (entries.length >= limit) break;
  }

  return entries;
}



export async function getPlatformPointsPodium(
  limit = 3
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  // Garante que o líder de hoje fica registado mesmo em dias sem novas sessões.
  await supabase.rpc("evaluate_platform_leader_day").then(
    () => undefined,
    () => undefined
  );

  const { data, error } = await supabase.rpc("get_top_players_by_points", {
    p_limit: limit,
  });

  if (error || !data) return [];

  const rows = (Array.isArray(data) ? data : []) as Array<{
    user_id: string;
    total_score: number | string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>;

  return rows.map((row) => ({
    id: `points-${row.user_id}`,
    game_id: "platform",
    user_id: row.user_id,
    score: Number(row.total_score) || 0,
    metric: "score" as const,
    created_at: new Date().toISOString(),
    profile: {
      display_name: row.display_name ?? "",
      username: row.username,
      avatar_url: row.avatar_url,
    },
  }));
}

export async function getTopPlayersToday(
  limit = 3
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_top_players_today", {
    p_limit: limit,
  });

  if (error || !data) return [];

  const rows = (Array.isArray(data) ? data : []) as Array<{
    user_id: string;
    points: number | string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>;

  return rows.map((row) => ({
    id: `today-${row.user_id}`,
    game_id: "platform",
    user_id: row.user_id,
    score: Number(row.points) || 0,
    metric: "score" as const,
    created_at: new Date().toISOString(),
    profile: {
      display_name: row.display_name ?? "",
      username: row.username,
      avatar_url: row.avatar_url,
    },
  }));
}

export type RankingPreview = {

  game: Pick<GameRecord, "slug" | "name" | "name_en" | "thumbnail_url" | "module_id">;

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

        name_en: game.name_en,

        thumbnail_url: game.thumbnail_url,

        module_id: game.module_id,

      },

      topEntry: entries[0] ?? null,

      metric,

    });

  }



  return previews;

}

