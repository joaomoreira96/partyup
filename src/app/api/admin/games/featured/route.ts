import { NextResponse } from "next/server";
import { z } from "zod";
import { setGameFeatured } from "@/services/category-admin.service";
import { isAdmin } from "@/services/auth.service";

const schema = z.object({
  gameId: z.string().uuid(),
  featured: z.boolean(),
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

  const result = await setGameFeatured(parsed.data.gameId, parsed.data.featured);
  if (!result.ok) {
    return NextResponse.json(
      {
        message:
          result.error === "game_not_found"
            ? "Jogo não encontrado."
            : result.error === "forbidden"
              ? "Acesso negado."
              : "Não foi possível atualizar o destaque.",
        detail: process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
