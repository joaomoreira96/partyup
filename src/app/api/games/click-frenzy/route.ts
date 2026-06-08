import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { getRoomByCode } from "@/services/room.service";
import { normalizeRoomCode } from "@/lib/rooms/codes";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  finishClickFrenzy,
  resetClickFrenzy,
  startClickFrenzy,
  submitClickFrenzyScore,
} from "@/services/click-frenzy.service";

type ClickFrenzyAction = "start" | "submit" | "finish" | "reset";

export async function POST(request: Request) {
  const body = await request.json();
  const { code, action, playerId, clicks, lastClickAt } = body as {
    code: string;
    action: ClickFrenzyAction;
    playerId?: string;
    clicks?: number;
    lastClickAt?: number;
  };

  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, offline: true, action });
  }

  const room = await getRoomByCode(normalized);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  const user = await getSessionUser();

  if (action === "start") {
    const result = await startClickFrenzy({
      roomId: room.id,
      gameId: room.game_id,
      hostUserId: user?.id,
      hostPlayerId: playerId,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        need_player: "São necessários jogadores na sala.",
        all_must_be_ready: "Todos os jogadores devem estar prontos.",
        host_only: "Apenas o anfitrião pode iniciar.",
        room_update_failed: "Não foi possível sincronizar a sala.",
      };
      return NextResponse.json(
        {
          error: messages[result.error] ?? "Não foi possível iniciar.",
          detail: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "playing",
      metadata: result.metadata,
      playUrl: `/games/click-frenzy/play?room=${normalized}`,
    });
  }

  if (action === "submit") {
    if (!playerId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const result = await submitClickFrenzyScore({
      roomId: room.id,
      playerId,
      clicks: Number(clicks ?? 0),
      lastClickAt: Number(lastClickAt ?? 0),
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Submissão inválida" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, metadata: result.metadata });
  }

  if (action === "finish") {
    const result = await finishClickFrenzy({
      roomId: room.id,
      gameId: room.game_id,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "finish_failed", metadata: result.metadata },
        { status: result.error === "not_finished" ? 409 : 500 }
      );
    }
    return NextResponse.json({ ok: true, metadata: result.metadata });
  }

  if (action === "reset") {
    const result = await resetClickFrenzy({ roomId: room.id });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "reset_failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, metadata: result.metadata });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
