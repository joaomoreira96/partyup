import { NextResponse } from "next/server";

/** @deprecated Use PartyUp SDK → /api/sdk/game/end */
export async function POST() {
  return NextResponse.json(
    {
      message:
        "Este endpoint foi descontinuado. Usa o PartyUp SDK (endGame) na integração do jogo.",
    },
    { status: 410 }
  );
}
