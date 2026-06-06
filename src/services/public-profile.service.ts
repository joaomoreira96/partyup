import "server-only";

import { getMetricForGame } from "@/lib/games/metrics";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSessionUser } from "@/services/auth.service";
import { getAchievementsForUser } from "@/services/achievements.service";
import { getPublishedGames } from "@/services/game.service";
import { getUserStats } from "@/services/stats.service";
import type {
  ActiveRanking,
  LeaderboardMetric,
  PersonalRecord,
  Profile,
  ProfileActivityItem,
  PublicPlayerProfile,
  TopGameStat,
} from "@/types/platform";

type SessionRow = {
  game_id: string;
  duration_seconds: number | null;
  score: number | null;
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

type LeaderboardRow = {
  game_id: string;
  score: number;
  metric: LeaderboardMetric;
  games:
    | { slug: string; name: string; name_en?: string | null; module_id: string }
    | { slug: string; name: string; name_en?: string | null; module_id: string }[]
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

function aggregateTopGames(sessions: SessionRow[]): TopGameStat[] {
  const map = new Map<
    string,
    TopGameStat & { _bestScore: number }
  >();

  for (const row of sessions) {
    const game = pickGame(row.games);
    if (!game) continue;
    const metric = getMetricForGame(game.module_id);
    const duration = row.duration_seconds ?? 0;
    const score = Number(row.score ?? 0);
    const existing = map.get(row.game_id);

    if (!existing) {
      map.set(row.game_id, {
        gameId: row.game_id,
        slug: game.slug,
        name: game.name,
        name_en: game.name_en ?? undefined,
        moduleId: game.module_id,
        thumbnailUrl: game.thumbnail_url ?? null,
        sessions: 1,
        playTimeSeconds: duration,
        bestScore: score,
        metric,
        _bestScore: score,
      });
      continue;
    }

    existing.sessions += 1;
    existing.playTimeSeconds += duration;
    const better =
      metric === "time"
        ? score > 0 && (existing._bestScore <= 0 || score < existing._bestScore)
        : score > existing._bestScore;
    if (better) {
      existing._bestScore = score;
      existing.bestScore = score;
    }
  }

  return [...map.values()]
    .map(({ _bestScore: _, ...rest }) => rest)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);
}

function buildPersonalRecords(rows: LeaderboardRow[]): PersonalRecord[] {
  const bestByGame = new Map<
    string,
    LeaderboardRow & { gameName: string; gameNameEn?: string; slug: string }
  >();

  for (const row of rows) {
    const game = pickGame(row.games);
    if (!game) continue;
    const metric = row.metric ?? getMetricForGame(game.module_id);
    const score = Number(row.score);
    const key = row.game_id;
    const prev = bestByGame.get(key);
    const better =
      !prev ||
      (metric === "time"
        ? score < Number(prev.score)
        : score > Number(prev.score));

    if (better) {
      bestByGame.set(key, {
        ...row,
        metric,
        gameName: game.name,
        gameNameEn: game.name_en ?? undefined,
        slug: game.slug,
      });
    }
  }

  return [...bestByGame.values()].map((row) => ({
    gameId: row.game_id,
    gameName: row.gameName,
    gameNameEn: row.gameNameEn,
    slug: row.slug,
    label: `Melhor ${row.metric === "time" ? "tempo" : "pontuação"} — ${row.gameName}`,
    score: Number(row.score),
    metric: row.metric,
  }));
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
    .from("leaderboards")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("metric", metric);

  query = ascending
    ? query.lt("score", userBest)
    : query.gt("score", userBest);

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
    if (!ach) continue;
    items.push({
      id: `ach-${ua.unlocked_at}`,
      type: "achievement",
      message: `Conquista «${ach.name}»`,
      createdAt: ua.unlocked_at,
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
  const allAchievements = await getAchievementsForUser(profile.id);
  const achievements = allAchievements.filter((a) => Boolean(a.unlocked_at));
  const achievementCount = achievements.length;

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
      personalRecords: [],
      activeRankings: [],
      recentActivity: [],
      isOwner,
    };
  }

  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("game_sessions")
    .select(
      `game_id, duration_seconds, score,
       games ( slug, name, name_en, module_id, thumbnail_url )`
    )
    .eq("user_id", profile.id);

  const topGames = aggregateTopGames((sessions ?? []) as SessionRow[]);

  const { data: lbRows } = await supabase
    .from("leaderboards")
    .select(
      `game_id, score, metric,
       games ( slug, name, name_en, module_id )`
    )
    .eq("user_id", profile.id);

  const personalRecords = buildPersonalRecords((lbRows ?? []) as LeaderboardRow[]);
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
    personalRecords,
    activeRankings,
    recentActivity,
    isOwner,
  };
}

