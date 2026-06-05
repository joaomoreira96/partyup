import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/services/auth.service";
import { listUsersForAdmin, updateUserBan } from "@/services/admin.service";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const users = await listUsersForAdmin(q);

  return NextResponse.json({ users });
}

const banSchema = z.object({
  userId: z.string().uuid(),
  is_banned: z.boolean(),
  banned_until: z.string().datetime().nullable().optional(),
  ban_reason: z.string().max(500).nullable().optional(),
});

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.is_banned && !parsed.data.banned_until && !parsed.data.ban_reason?.trim()) {
    return NextResponse.json(
      { message: "Indica o motivo do ban." },
      { status: 400 }
    );
  }

  if (
    parsed.data.is_banned &&
    parsed.data.banned_until &&
    new Date(parsed.data.banned_until) <= new Date()
  ) {
    return NextResponse.json(
      { message: "A data de fim do ban tem de ser no futuro." },
      { status: 400 }
    );
  }

  const result = await updateUserBan(parsed.data.userId, {
    is_banned: parsed.data.is_banned,
    banned_until: parsed.data.is_banned ? (parsed.data.banned_until ?? null) : null,
    ban_reason: parsed.data.is_banned ? (parsed.data.ban_reason ?? null) : null,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      forbidden: "Acesso negado.",
      user_not_found: "Utilizador não encontrado.",
      cannot_ban_admin: "Não é possível banir um administrador.",
    };
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "cannot_ban_admin"
          ? 400
          : 404;

    return NextResponse.json(
      {
        message:
          messages[result.error] ??
          "Não foi possível atualizar o ban. Aplica as migrations do Supabase (admin_set_user_ban).",
        detail: process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
