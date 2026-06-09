import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { processAchievementHints } from "@/services/achievement-hints.service";
import { logGameEvent } from "@/services/event.service";
import { validateScoreForServer } from "@/services/score-validation.service";
import { recordPlaySession, submitLeaderboardScore } from "@/services/stats.service";
import { resolveCanonicalGameId, resolveModuleIdForGame } from "@/services/game.service";
import type { AchievementHint } from "@/lib/partyup-sdk/types";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    gameId,
    gameSlug,
    guestId,
    result,
    submitScore,
    achievementHints,
    events,
  } = body as {
    gameId: string;
    gameSlug?: string;
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

  const canonicalGameId = await resolveCanonicalGameId(gameId, gameSlug);
  if (!canonicalGameId) {
    return NextResponse.json(
      { message: "Jogo não encontrado na plataforma." },
      { status: 404 }
    );
  }

  const moduleId = await resolveModuleIdForGame(canonicalGameId);

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
    gameId: canonicalGameId,
    userId: user?.id,
    payload: { guestId, score: result.score, events },
  });

  const sessionResult = await recordPlaySession({
    gameId: canonicalGameId,
    userId: user?.id,
    result,
    sessionMetadata:
      events && typeof events === "object"
        ? (events as Record<string, unknown>)
        : undefined,
  });

  if (!sessionResult.ok && sessionResult.error !== "offline") {
    console.error("[game/end] recordPlaySession failed:", sessionResult.error);
    return NextResponse.json(
      {
        message: "Não foi possível guardar a sessão de jogo.",
        detail: sessionResult.error,
      },
      { status: 500 }
    );
  }

  let ranked = false;
  const unlockedAchievements = sessionResult.ok
    ? (sessionResult.unlockedAchievements ?? [])
    : [];

  if (user && submitScore) {
    const scoreResult = await submitLeaderboardScore({
      gameId: canonicalGameId,
      userId: user.id,
      score: result.score,
      metric: result.metric,
    });

    ranked = scoreResult.ok;

    if (achievementHints?.length) {
      await processAchievementHints(user.id, achievementHints, {
        score: result.score,
        metric: result.metric,
        moduleId,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranked,
    unlockedAchievements,
  });
}
