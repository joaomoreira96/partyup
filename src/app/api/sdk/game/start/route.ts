import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";
import { resolveCanonicalGameId } from "@/services/game.service";

export async function POST(request: Request) {
  const body = await request.json();
  const { gameId, gameSlug, guestId, roomCode } = body as {
    gameId: string;
    gameSlug?: string;
    guestId?: string;
    roomCode?: string;
  };

  if (!gameId) {
    return NextResponse.json(
      { message: "Jogo inválido." },
      { status: 400 }
    );
  }

  const user = await getSessionUser();
  const canonicalGameId = await resolveCanonicalGameId(gameId, gameSlug);

  if (canonicalGameId) {
    await logGameEvent({
      eventType: "GAME_STARTED",
      gameId: canonicalGameId,
      userId: user?.id,
      payload: { guestId, roomCode, gameSlug },
    });
  }

  return NextResponse.json({ ok: true });
}
