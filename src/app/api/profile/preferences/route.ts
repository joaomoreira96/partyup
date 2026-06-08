import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const VALID_THEMES = ["light", "dark", "system"];
const VALID_LOCALES = ["pt", "en"];

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, offline: true });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    theme?: unknown;
    locale?: unknown;
  };

  const update: Record<string, string> = {};

  if (typeof body.theme === "string" && VALID_THEMES.includes(body.theme)) {
    update.theme = body.theme;
  }
  if (typeof body.locale === "string" && VALID_LOCALES.includes(body.locale)) {
    update.locale = body.locale;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível guardar as preferências.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
