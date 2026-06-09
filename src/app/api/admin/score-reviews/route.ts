import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/services/auth.service";
import {
  createUserFlag,
  listScoreReviews,
  reviewLeaderboardScore,
} from "@/services/admin-security.service";
import { updateUserBan } from "@/services/admin.service";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const reviews = await listScoreReviews();
  return NextResponse.json({ reviews });
}

const reviewSchema = z.object({
  leaderboardId: z.string().uuid(),
  action: z.enum(["approve", "reject", "ban", "flag"]),
  reason: z.string().max(500).optional(),
  userId: z.string().uuid().optional(),
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

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const { leaderboardId, action, reason, userId } = parsed.data;

  if (action === "approve" || action === "reject") {
    const result = await reviewLeaderboardScore(leaderboardId, action, reason);
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    return NextResponse.json({ message: "Utilizador obrigatório." }, { status: 400 });
  }

  if (action === "flag") {
    const result = await createUserFlag(
      userId,
      reason?.trim() || "MANUAL_REVIEW",
      "medium"
    );
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "ban") {
    const banResult = await updateUserBan(userId, {
      is_banned: true,
      banned_until: null,
      ban_reason: reason?.trim() || "Score abuse",
    });
    if (!banResult.ok) {
      return NextResponse.json({ message: banResult.error }, { status: 400 });
    }
    await reviewLeaderboardScore(leaderboardId, "reject", reason);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
}
