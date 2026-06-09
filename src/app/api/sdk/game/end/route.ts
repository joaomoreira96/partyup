import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/security/client-ip";
import {
  enforceRateLimits,
  rateLimitKey,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { processScoreSubmission } from "@/lib/security/score-submit";
import { getSessionUser } from "@/services/auth.service";
import { processAchievementHints } from "@/services/achievement-hints.service";
import { logGameEvent } from "@/services/event.service";
import { validateScoreForServer } from "@/services/score-validation.service";
import { recordPlaySession } from "@/services/stats.service";
import { logSecurityEvent } from "@/services/security-event.service";
import { assertNotBanned } from "@/services/ban-check.service";
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
  const ip = getClientIp(request);
  const user = await getSessionUser();

  if (user && submitScore) {
    const banCheck = await assertNotBanned(user.id, "score_submit", ip);
    if (banCheck.banned) {
      return NextResponse.json({ message: banCheck.message }, { status: 403 });
    }

    const rateLimited = await enforceRateLimits(
      RATE_LIMITS.scoreSubmit.map((r) => ({
        key: rateLimitKey("score_submit", user.id, ip, r.windowSeconds),
        ...r,
      })),
      { userId: user.id, ip }
    );
    if (rateLimited) {
      return NextResponse.json(
        { message: "Demasiadas submissões. Aguarda um momento." },
        { status: 429 }
      );
    }
  }

  const validation = validateScoreForServer({
    score: result.score,
    durationMs: result.durationMs,
    metric: result.metric,
    moduleId,
  });

  if (validation.outcome === "hard_reject") {
    if (user) {
      await logSecurityEvent({
        eventType: "INVALID_SCORE",
        severity: "high",
        userId: user.id,
        ipAddress: ip ?? undefined,
        metadata: {
          gameId: canonicalGameId,
          score: result.score,
          durationMs: result.durationMs,
          moduleId,
          reason: validation.error,
        },
      });
    }
    return NextResponse.json(
      { message: "Pontuação não aceite. Tenta jogar novamente." },
      { status: 422 }
    );
  }

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
  let pendingReview = false;
  const unlockedAchievements = sessionResult.ok
    ? (sessionResult.unlockedAchievements ?? [])
    : [];

  if (user && submitScore) {
    const scoreResult = await processScoreSubmission({
      gameId: canonicalGameId,
      userId: user.id,
      score: result.score,
      durationMs: result.durationMs,
      metric: result.metric,
      moduleId,
      ip,
    });

    if (scoreResult.ok) {
      ranked = scoreResult.ranked;
      pendingReview = scoreResult.pendingReview;
    }

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
    pendingReview,
    unlockedAchievements,
  });
}
