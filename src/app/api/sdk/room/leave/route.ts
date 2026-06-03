import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";
import { normalizeRoomCode } from "@/lib/rooms/codes";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function POST(request: Request) {
  const body = await request.json();
  const { code } = body as { code: string };
  const normalized = normalizeRoomCode(code ?? "");

  if (!normalized) {
    return NextResponse.json({ message: "Código inválido." }, { status: 400 });
  }

  const user = await getSessionUser();

  if (isSupabaseConfigured() && user) {
    const supabase = await createClient();
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", normalized)
      .maybeSingle();

    if (room) {
      await supabase
        .from("room_players")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", user.id);
    }
  }

  await logGameEvent({
    eventType: "PLAYER_LEFT",
    userId: user?.id,
    payload: { code: normalized },
  });

  return NextResponse.json({ ok: true });
}
