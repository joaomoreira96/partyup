import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";
import { validateScoreForServer } from "@/services/score-validation.service";
import { submitLeaderboardScore } from "@/services/stats.service";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { message: "Inicia sessão para submeter pontuação." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { gameId, score, metric } = body as {
    gameId: string;
    score: number;
    metric?: "score" | "time" | "streak";
  };

  if (!gameId) {
    return NextResponse.json({ message: "Jogo inválido." }, { status: 400 });
  }

  let moduleId: string | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("games")
      .select("module_id")
      .eq("id", gameId)
      .maybeSingle();
    moduleId = data?.module_id;
  }

  const validation = validateScoreForServer({
    score,
    durationMs: 0,
    metric,
    moduleId,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { message: "Pontuação não aceite." },
      { status: 422 }
    );
  }

  const result = await submitLeaderboardScore({
    gameId,
    userId: user.id,
    score,
    metric,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: "Não foi possível guardar a pontuação." },
      { status: 500 }
    );
  }

  await logGameEvent({
    eventType: "SCORE_SUBMITTED",
    gameId,
    userId: user.id,
    payload: { score, metric },
  });

  return NextResponse.json({ ok: true });
}
