import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/security/client-ip";
import {
  enforceRateLimits,
  rateLimitKey,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { processScoreSubmission } from "@/lib/security/score-submit";
import { getSessionUser } from "@/services/auth.service";
import { resolveCanonicalGameId, resolveModuleIdForGame } from "@/services/game.service";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { message: "Inicia sessão para submeter pontuação." },
      { status: 401 }
    );
  }

  const ip = getClientIp(request);
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

  const body = await request.json();
  const { gameId, gameSlug, score, metric } = body as {
    gameId: string;
    gameSlug?: string;
    score: number;
    metric?: "score" | "time" | "streak";
  };

  if (!gameId) {
    return NextResponse.json({ message: "Jogo inválido." }, { status: 400 });
  }

  const canonicalGameId = await resolveCanonicalGameId(gameId, gameSlug);
  if (!canonicalGameId) {
    return NextResponse.json(
      { message: "Jogo não encontrado na plataforma." },
      { status: 404 }
    );
  }

  const moduleId = await resolveModuleIdForGame(canonicalGameId);

  const result = await processScoreSubmission({
    gameId: canonicalGameId,
    userId: user.id,
    score,
    durationMs: 0,
    metric,
    moduleId,
    ip,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    ranked: result.ranked,
    pendingReview: result.pendingReview,
  });
}
