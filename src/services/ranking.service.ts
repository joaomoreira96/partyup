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



  let query = supabase

    .from("user_game_stats")

    .select(

      `user_id, game_id, best_score, last_played_at,

       profiles ( display_name, username, avatar_url )`

    )

    .eq("game_id", gameId)

    .gt("best_score", 0);



  const { data, error } = await query

    .order("best_score", { ascending })

    .limit(limit);



  if (error || !data) return [];



  return data.map((row) => {

    const { profiles: profilesRaw, last_played_at, ...entry } = row as {

      user_id: string;

      game_id: string;

      best_score: number;

      last_played_at?: string;

      profiles: LeaderboardEntry["profile"] | LeaderboardEntry["profile"][];

    };



    return {

      id: `${entry.user_id}-${entry.game_id}`,

      game_id: entry.game_id,

      user_id: entry.user_id,

      score: Number(entry.best_score),

      metric,

      created_at: last_played_at ?? new Date().toISOString(),

      profile: normalizeProfile(profilesRaw) ?? undefined,

    };

  });

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

