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
  const ascending = metric === "time";

  const { data: userRow } = await supabase
    .from("user_game_stats")
    .select("best_score")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .maybeSingle();

  const bestScore = Number(userRow?.best_score ?? 0);
  if (!bestScore) {
    return NextResponse.json({ bestScore: 0, rank: null });
  }

  let rankQuery = supabase
    .from("user_game_stats")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("best_score", 0);

  rankQuery = ascending
    ? rankQuery.lt("best_score", bestScore)
    : rankQuery.gt("best_score", bestScore);

  const { count, error } = await rankQuery;
  if (error || count === null) {
    return NextResponse.json({ bestScore, rank: null });
  }

  return NextResponse.json({ bestScore, rank: count + 1 });
}
