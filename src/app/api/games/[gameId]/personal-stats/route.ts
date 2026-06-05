import { NextResponse } from "next/server";
import { getMetricForGame } from "@/lib/games/metrics";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSessionUser } from "@/services/auth.service";
import { resolveModuleIdForGame } from "@/services/game.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ bestScore: 0, rank: null });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ bestScore: 0, rank: null });
  }

  const { gameId } = await context.params;
  const supabase = await createClient();

  const moduleId = (await resolveModuleIdForGame(gameId)) ?? "snake";
  const metric = getMetricForGame(moduleId);

  const { data: entries } = await supabase
    .from("leaderboards")
    .select("user_id, score")
    .eq("game_id", gameId)
    .eq("metric", metric)
    .order("score", { ascending: metric === "time" });

  if (!entries?.length) {
    return NextResponse.json({ bestScore: 0, rank: null });
  }

  const userScores = entries
    .filter((row) => row.user_id === user.id)
    .map((row) => Number(row.score));

  const bestScore = userScores.length ? Math.max(...userScores) : 0;

  if (!bestScore) {
    return NextResponse.json({ bestScore: 0, rank: null });
  }

  const uniqueRanked = new Map<string, number>();
  for (const row of entries) {
    const score = Number(row.score);
    const existing = uniqueRanked.get(row.user_id);
    if (metric === "time") {
      if (existing === undefined || score < existing) {
        uniqueRanked.set(row.user_id, score);
      }
    } else if (existing === undefined || score > existing) {
      uniqueRanked.set(row.user_id, score);
    }
  }

  const ranked = [...uniqueRanked.entries()]
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => (metric === "time" ? a.score - b.score : b.score - a.score));

  const rankIndex = ranked.findIndex((row) => row.userId === user.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  return NextResponse.json({ bestScore, rank });
}
