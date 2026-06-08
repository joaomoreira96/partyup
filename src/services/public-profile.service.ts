import "server-only";

import { getMetricForGame } from "@/lib/games/metrics";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSessionUser } from "@/services/auth.service";
import { getAchievementsForUser } from "@/services/achievements.service";
import { getPublishedGames } from "@/services/game.service";
import { getUserFavoriteGames } from "@/services/favorites.service";
import { getUserStats } from "@/services/stats.service";
import type {
  ActiveRanking,
  LeaderboardMetric,
  PersonalRecord,
  Profile,
  ProfileActivityItem,
  PublicFavoriteGame,
  PublicPlayerProfile,
  TopGameStat,
} from "@/types/platform";

type UserGameStatsRow = {
  game_id: string;
  best_score: number;
  sessions_played: number;
  play_time_seconds: number;
  last_played_at?: string;
  games:
    | {
        slug: string;
        name: string;
        name_en?: string | null;
        module_id: string;
        thumbnail_url: string | null;
      }
    | {
        slug: string;
        name: string;
        name_en?: string | null;
        module_id: string;
        thumbnail_url: string | null;
      }[]
    | null;
};

function pickOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function pickGame<T extends { slug: string; name: string }>(
  raw: T | T[] | null | undefined
): T | null {
  return pickOne(raw);
}

async function getFavoriteGamesForProfile(
  userId: string
): Promise<PublicFavoriteGame[]> {
  const favorites = await getUserFavoriteGames(userId);
  return favorites.map((game) => ({
    gameId: game.id,
    slug: game.slug,
    name: game.name,
    name_en: game.name_en ?? undefined,
    thumbnailUrl: game.thumbnail_url ?? null,
  }));
}

async function getProfileByUsername(username: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (data?.deleted_at) return null;
  return data as Profile | null;
}

function mapUserGameStatsRows(rows: UserGameStatsRow[]): TopGameStat[] {
  const games: TopGameStat[] = [];

  for (const row of rows) {
    const game = pickGame(row.games);
    if (!game) continue;

    games.push({
      gameId: row.game_id,
      slug: game.slug,
      name: game.name,
      name_en: game.name_en ?? undefined,
      moduleId: game.module_id,
      thumbnailUrl: game.thumbnail_url ?? null,
      sessions: Number(row.sessions_played ?? 0),
      playTimeSeconds: Number(row.play_time_seconds ?? 0),
      bestScore: Number(row.best_score ?? 0),
      metric: getMetricForGame(game.module_id),
    });
  }

  return games.sort((a, b) => b.sessions - a.sessions);
}

function buildPersonalRecords(rows: UserGameStatsRow[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const row of rows) {
    const game = pickGame(row.games);
    if (!game) continue;

    const metric = getMetricForGame(game.module_id);
    const score = Number(row.best_score ?? 0);
    if (score <= 0) continue;

    records.push({
      gameId: row.game_id,
      gameName: game.name,
      gameNameEn: game.name_en ?? undefined,
      slug: game.slug,
      label: `Melhor ${metric === "time" ? "tempo" : "pontuação"} — ${game.name}`,
      score,
      metric,
    });
  }

  return records;
}

async function getRankForGame(
  gameId: string,
  userId: string,
  metric: LeaderboardMetric,
  userBest: number
): Promise<number | null> {
  if (userBest <= 0 && metric !== "time") return null;

  const supabase = await createClient();
  const ascending = metric === "time";

  let query = supabase
    .from("user_game_stats")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("best_score", 0);

  query = ascending
    ? query.lt("best_score", userBest)
    : query.gt("best_score", userBest);

  const { count, error } = await query;
  if (error || count === null) return null;
  return count + 1;
}

async function buildActiveRankings(
  userId: string,
  records: PersonalRecord[]
): Promise<ActiveRanking[]> {
  const rankings: ActiveRanking[] = [];

  for (const record of records.slice(0, 6)) {
    const rank = await getRankForGame(
      record.gameId,
      userId,
      record.metric,
      record.score
    );
    if (rank && rank <= 100) {
      rankings.push({
        gameId: record.gameId,
        gameName: record.gameName,
        gameNameEn: record.gameNameEn,
        slug: record.slug,
        rank,
        metric: record.metric,
      });
    }
  }

  return rankings.sort((a, b) => a.rank - b.rank);
}

async function buildRecentActivity(
  userId: string,
  showActivity: boolean
): Promise<ProfileActivityItem[]> {
  if (!showActivity) return [];

  const supabase = await createClient();
  const items: ProfileActivityItem[] = [];

  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("id, ended_at, games ( name )")
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(5);

  for (const s of sessions ?? []) {
    const game = pickOne(
      s.games as { name: string } | { name: string }[] | null
    );
    items.push({
      id: s.id,
      type: "GAME_FINISHED",
      message: game ? `Jogou ${game.name}` : "Jogou uma partida",
      createdAt: s.ended_at ?? new Date().toISOString(),
    });
  }

  const { data: recentAchievements } = await supabase
    .from("user_achievements")
    .select("unlocked_at, achievements ( name )")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false })
    .limit(4);

  for (const ua of recentAchievements ?? []) {
    const ach = pickOne(
      ua.achievements as { name: string } | { name: string }[] | null
    );
    const unlockedAt = ua.unlocked_at;
    if (!ach || !unlockedAt) continue;
    items.push({
      id: `ach-${unlockedAt}`,
      type: "achievement",
      message: `Conquista «${ach.name}»`,
      createdAt: unlockedAt,
    });
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);
}

export async function getPublicPlayerProfile(
  username: string
): Promise<PublicPlayerProfile | null> {
  const profile = await getProfileByUsername(username);
  if (!profile?.username) return null;

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === profile.id;
  const isPublic = profile.public_profile !== false;

  if (!isPublic && !isOwner) return null;

  const stats = await getUserStats(profile.id);
  const achievements = await getAchievementsForUser(profile.id);
  const achievementCount = achievements.filter((a) =>
    Boolean(a.unlocked_at)
  ).length;

  if (!isSupabaseConfigured()) {
    const games = await getPublishedGames();
    return {
      profile,
      stats,
      achievementCount,
      achievements,
      topGames: games.slice(0, 3).map((g, i) => ({
        gameId: g.id,
        slug: g.slug,
        name: g.name,
        name_en: g.name_en,
        moduleId: g.module_id,
        thumbnailUrl: g.thumbnail_url,
        sessions: 10 - i * 2,
        playTimeSeconds: 3600,
        bestScore: 1000 * (i + 1),
        metric: getMetricForGame(g.module_id),
      })),
      favoriteGames: [],
      personalRecords: [],
      activeRankings: [],
      recentActivity: [],
      isOwner,
    };
  }

  const supabase = await createClient();

  const { data: gameStats } = await supabase
    .from("user_game_stats")
    .select(
      `game_id, best_score, sessions_played, play_time_seconds, last_played_at,
       games ( slug, name, name_en, module_id, thumbnail_url )`
    )
    .eq("user_id", profile.id)
    .order("last_played_at", { ascending: false });

  const statsRows = (gameStats ?? []) as UserGameStatsRow[];
  const topGames = mapUserGameStatsRows(statsRows);
  const favoriteGames =
    topGames.length === 0 ? await getFavoriteGamesForProfile(profile.id) : [];
  const personalRecords = buildPersonalRecords(statsRows);
  const activeRankings = await buildActiveRankings(profile.id, personalRecords);
  const recentActivity = await buildRecentActivity(
    profile.id,
    profile.show_activity !== false
  );

  return {
    profile,
    stats,
    achievementCount,
    achievements,
    topGames,
    favoriteGames,
    personalRecords,
    activeRankings,
    recentActivity,
    isOwner,
  };
}

