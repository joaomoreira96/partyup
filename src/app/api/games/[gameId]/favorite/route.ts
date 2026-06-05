import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { toggleFavoriteGame } from "@/services/favorites.service";

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Sessão expirada.",
  invalid_game: "Jogo inválido.",
  game_not_found: "Jogo não encontrado.",
  offline: "Serviço indisponível.",
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: ERROR_MESSAGES.not_authenticated }, { status: 401 });
  }

  const { gameId } = await context.params;
  if (!gameId) {
    return NextResponse.json({ message: ERROR_MESSAGES.invalid_game }, { status: 400 });
  }

  const result = await toggleFavoriteGame(gameId);

  if (!result.ok) {
    const status =
      result.error === "not_authenticated"
        ? 401
        : result.error === "game_not_found"
          ? 404
          : 500;
    return NextResponse.json(
      {
        message: ERROR_MESSAGES[result.error] ?? "Não foi possível atualizar favoritos.",
        error: result.error,
      },
      { status }
    );
  }

  return NextResponse.json({ ok: true, isFavorite: result.isFavorite });
}
