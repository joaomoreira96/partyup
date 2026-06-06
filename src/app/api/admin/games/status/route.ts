import { NextResponse } from "next/server";
import { z } from "zod";
import { setGameStatus } from "@/services/category-admin.service";
import { isAdmin } from "@/services/auth.service";

const schema = z.object({
  gameId: z.string().uuid(),
  status: z.enum(["active", "disabled"]),
});

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await setGameStatus(parsed.data.gameId, parsed.data.status);
  if (!result.ok) {
    return NextResponse.json(
      {
        message:
          result.error === "game_not_found"
            ? "Jogo não encontrado."
            : result.error === "forbidden"
              ? "Acesso negado."
              : result.error === "invalid_status"
                ? "Estado inválido."
                : "Não foi possível atualizar o estado do jogo.",
        detail: process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
