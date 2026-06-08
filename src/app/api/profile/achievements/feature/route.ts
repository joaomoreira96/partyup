import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, offline: true });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    achievementId?: unknown;
    featured?: unknown;
  };

  if (typeof body.achievementId !== "string" || typeof body.featured !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_achievements")
    .update({ is_featured: body.featured })
    .eq("user_id", user.id)
    .eq("achievement_id", body.achievementId);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível atualizar o destaque.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
