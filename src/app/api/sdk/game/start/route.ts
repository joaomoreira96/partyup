import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";

export async function POST(request: Request) {
  const body = await request.json();
  const { gameId, guestId, roomCode } = body as {
    gameId: string;
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

  await logGameEvent({
    eventType: "GAME_STARTED",
    gameId,
    userId: user?.id,
    payload: { guestId, roomCode },
  });

  return NextResponse.json({ ok: true });
}
