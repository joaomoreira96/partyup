import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { processAchievementHints } from "@/services/achievement-hints.service";
import { logGameEvent } from "@/services/event.service";
import { validateScoreForServer } from "@/services/score-validation.service";
import { recordPlaySession, submitLeaderboardScore } from "@/services/stats.service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { resolveModuleIdForGame } from "@/services/game.service";
import type { AchievementHint } from "@/lib/partyup-sdk/types";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    gameId,
    guestId,
    result,
    submitScore,
    achievementHints,
    events,
  } = body as {
    gameId: string;
    guestId?: string;
    result: {
      score: number;
      durationMs: number;
      metric?: "score" | "time" | "streak";
    };
    submitScore?: boolean;
    achievementHints?: AchievementHint[];
    events?: Record<string, unknown>;
  };

  if (!gameId || !result) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const moduleId = await resolveModuleIdForGame(gameId);

  const validation = validateScoreForServer({
    score: result.score,
    durationMs: result.durationMs,
    metric: result.metric,
    moduleId,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { message: "Pontuação não aceite. Tenta jogar novamente." },
      { status: 422 }
    );
  }

  const user = await getSessionUser();

  await logGameEvent({
    eventType: "GAME_FINISHED",
    gameId,
    userId: user?.id,
    payload: { guestId, score: result.score, events },
  });

  await recordPlaySession({
    gameId,
    userId: user?.id,
    guestId,
    result,
  });

  if (user && submitScore) {
    const scoreResult = await submitLeaderboardScore({
      gameId,
      userId: user.id,
      score: result.score,
      metric: result.metric,
    });

    if (!scoreResult.ok) {
      return NextResponse.json(
        { message: "Não foi possível registar no ranking." },
        { status: 500 }
      );
    }

    if (achievementHints?.length) {
      await processAchievementHints(user.id, achievementHints, {
        score: result.score,
        metric: result.metric,
        moduleId,
      });
    }

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_games_played, games_played")
        .eq("user_id", user.id)
        .maybeSingle();

      const played = stats?.total_games_played ?? stats?.games_played ?? 1;
      const { checkPostGameAchievements } = await import(
        "@/services/achievements.service"
      );
      await checkPostGameAchievements(user.id, {
        gamesPlayed: played,
        isFirstComplete: played <= 1,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranked: Boolean(user && submitScore),
  });
}
