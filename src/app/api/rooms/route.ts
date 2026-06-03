import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";
import { generateRoomCode, normalizeRoomCode } from "@/lib/rooms/codes";
import { isPlayableGame } from "@/lib/db/mappers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { STATIC_GAMES } from "@/lib/games/catalog";

export async function POST(request: Request) {
  const body = await request.json();
  const { gameSlug, guestName } = body as {
    gameSlug: string;
    guestName?: string;
  };

  if (!gameSlug) {
    return NextResponse.json({ error: "Jogo obrigatório" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    const game = STATIC_GAMES.find((g) => g.slug === gameSlug);
    if (!game || !isPlayableGame(game)) {
      return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
    }
    const code = generateRoomCode();
    return NextResponse.json({
      code,
      offline: true,
      joinUrl: `/rooms/${code}?game=${gameSlug}`,
    });
  }

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, slug, supports_multiplayer")
    .eq("slug", gameSlug)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!game) {
    return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
  }

  if (!game.supports_multiplayer) {
    return NextResponse.json(
      { error: "Este jogo não suporta multiplayer" },
      { status: 400 }
    );
  }

  const user = await getSessionUser();
  let code = generateRoomCode();
  let attempts = 0;

  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateRoomCode();
    attempts += 1;
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      code,
      game_id: game.id,
      host_user_id: user?.id ?? null,
      status: "waiting",
    })
    .select("id, code")
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Não foi possível criar sala" }, { status: 500 });
  }

  await supabase.from("room_players").insert({
    room_id: room.id,
    user_id: user?.id ?? null,
    guest_name: user ? null : guestName ?? "Convidado",
    is_host: true,
    is_ready: false,
  });

  await logGameEvent({
    eventType: "ROOM_CREATED",
    gameId: game.id,
    userId: user?.id,
    roomId: room.id,
    payload: { code: room.code },
  });

  return NextResponse.json({
    code: room.code,
    joinUrl: `/rooms/${room.code}`,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { code, action, guestName } = body as {
    code: string;
    action: "join" | "ready" | "start";
    guestName?: string;
  };

  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, offline: true, action });
  }

  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_user_id, status, game_id")
    .eq("code", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  if (action === "join") {
    const { data: existing } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();

    if (!existing) {
      await supabase.from("room_players").insert({
        room_id: room.id,
        user_id: user?.id ?? null,
        guest_name: user ? null : guestName ?? "Convidado",
        is_host: false,
      });

      await logGameEvent({
        eventType: "ROOM_JOINED",
        gameId: room.game_id,
        userId: user?.id,
        roomId: room.id,
        payload: { guestName },
      });

      if (user && room.host_user_id && room.host_user_id !== user.id) {
        const { unlockAchievement } = await import(
          "@/services/achievements.service"
        );
        await unlockAchievement(room.host_user_id, "invite_friend");
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "ready") {
    if (!user) {
      return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
    }
    await supabase
      .from("room_players")
      .update({ is_ready: true, updated_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "start") {
    if (room.host_user_id !== user?.id) {
      return NextResponse.json({ error: "Apenas o anfitrião pode iniciar" }, { status: 403 });
    }
    await supabase
      .from("rooms")
      .update({ status: "playing", updated_at: new Date().toISOString() })
      .eq("id", room.id);

    await logGameEvent({
      eventType: "GAME_STARTED",
      gameId: room.game_id,
      userId: user?.id,
      roomId: room.id,
    });

    return NextResponse.json({ ok: true, status: "playing" });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
