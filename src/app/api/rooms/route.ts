import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { logGameEvent } from "@/services/event.service";
import {
  ensureDuelRoundStats,
  findRoomPlayer,
  listRoomPlayers,
  parseDuelMetadata,
  resetDuelRoom,
  startDuelRound,
  submitDuelClick,
} from "@/services/room-actions.service";
import { getRoomByCode } from "@/services/room.service";
import { generateRoomCode, normalizeRoomCode } from "@/lib/rooms/codes";
import { phaseFromTimestamps } from "@/lib/rooms/duel-state";
import { withRoundPhase } from "@/lib/rooms/round-completion";
import { isPlayableGame } from "@/lib/db/mappers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { STATIC_GAMES } from "@/lib/games/catalog";
import type { RoomPlayer } from "@/types/platform";

const DUEL_MAX_PLAYERS = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ offline: true, code });
  }

  const room = await getRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: gameRow } = await supabase
    .from("games")
    .select("slug, name")
    .eq("id", room.game_id)
    .maybeSingle();

  const players = await listRoomPlayers(room.id);
  const maxPlayers =
    (room as { max_players?: number }).max_players ?? DUEL_MAX_PLAYERS;
  const roundCtx = { playerCount: players.length, maxPlayers };
  const metadata = withRoundPhase(
    parseDuelMetadata((room as { metadata?: unknown }).metadata),
    roundCtx
  );
  const phase = phaseFromTimestamps(metadata, Date.now(), roundCtx);

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      hostUserId: (room as { host_user_id?: string | null }).host_user_id ?? null,
      gameId: room.game_id,
      gameSlug: gameRow?.slug ?? null,
      gameName: gameRow?.name ?? null,
      maxPlayers,
      metadata: { ...metadata, phase },
    },
    players,
  });
}

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

  const maxPlayers = gameSlug === "reaction-duel" ? DUEL_MAX_PLAYERS : 8;

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_game_room", {
    p_game_slug: gameSlug,
    p_code: code,
    p_guest_name: guestName ?? "Convidado",
    p_max_players: maxPlayers,
  });

  if (rpcError) {
    const msg = rpcError.message.toLowerCase();
    if (msg.includes("game_not_found") || msg.includes("p0002")) {
      return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
    }
    if (msg.includes("not_multiplayer") || msg.includes("p0001")) {
      return NextResponse.json(
        { error: "Este jogo não suporta multiplayer." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Não foi possível criar sala.",
        detail: rpcError.message,
      },
      { status: 500 }
    );
  }

  const created = rpcData as {
    room_id?: string;
    code?: string;
    player_id?: string;
    game_id?: string;
  } | null;

  if (!created?.room_id || !created.code || !created.game_id) {
    return NextResponse.json(
      { error: "Não foi possível criar sala.", detail: "invalid_rpc_response" },
      { status: 500 }
    );
  }

  await logGameEvent({
    eventType: "ROOM_CREATED",
    gameId: created.game_id,
    userId: user?.id,
    roomId: created.room_id,
    payload: { code: created.code },
  });

  return NextResponse.json({
    code: created.code,
    roomId: created.room_id,
    playerId: created.player_id,
    joinUrl: `/rooms/${created.code}?game=${encodeURIComponent(gameSlug)}`,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const {
    code,
    action,
    guestName,
    playerId,
    ready,
    clickedAt,
  } = body as {
    code: string;
    action:
      | "join"
      | "ready"
      | "unready"
      | "start"
      | "click"
      | "rematch"
      | "leave"
      | "record_stats";
    guestName?: string;
    playerId?: string;
    ready?: boolean;
    clickedAt?: number;
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

  const room = await getRoomByCode(normalized);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  if (action === "join") {
    const playersBefore = await listRoomPlayers(room.id);

    const { data: joinData, error: joinError } = await supabase.rpc("join_game_room", {
      p_room_id: room.id,
      p_guest_name: guestName ?? "Convidado",
      p_player_id: playerId ?? null,
    });

    if (joinError) {
      const msg = joinError.message.toLowerCase();
      if (msg.includes("room_full") || msg.includes("p0001")) {
        return NextResponse.json({ error: "Sala cheia" }, { status: 400 });
      }
      return NextResponse.json(
        {
          error: "Não foi possível entrar",
          detail: joinError.message,
        },
        { status: 500 }
      );
    }

    const joined = joinData as { player_id?: string } | null;
    const joinedPlayerId = joined?.player_id;

    if (!joinedPlayerId) {
      return NextResponse.json(
        { error: "Não foi possível entrar", detail: "invalid_join_response" },
        { status: 500 }
      );
    }

    const isNewPlayer = !playersBefore.some(
      (p) =>
        p.id === joinedPlayerId ||
        (user?.id && p.user_id === user.id) ||
        (!user?.id &&
          guestName &&
          !p.user_id &&
          p.guest_name === (guestName ?? "Convidado"))
    );

    if (isNewPlayer) {
      await logGameEvent({
        eventType: "ROOM_JOINED",
        gameId: room.game_id,
        userId: user?.id,
        roomId: room.id,
        payload: { guestName, playerId: joinedPlayerId },
      });

      if (user && room.host_user_id && room.host_user_id !== user.id) {
        const { unlockAchievement } = await import("@/services/achievements.service");
        await unlockAchievement(room.host_user_id, "invite_friend");
      }
    }

    return NextResponse.json({ ok: true, playerId: joinedPlayerId });
  }

  if (action === "ready" || action === "unready") {
    const isReady = action === "ready" ? ready !== false : false;

    const { data: readyData, error: readyError } = await supabase.rpc("ready_room_player", {
      p_room_id: room.id,
      p_guest_name: guestName ?? "Convidado",
      p_player_id: playerId ?? null,
      p_is_ready: isReady,
    });

    if (readyError) {
      return NextResponse.json(
        { error: "Não foi possível atualizar o estado.", detail: readyError.message },
        { status: 500 }
      );
    }

    const readyPlayerId = (readyData as { player_id?: string } | null)?.player_id;

    if (isReady && readyPlayerId) {
      await logGameEvent({
        eventType: "PLAYER_JOINED",
        gameId: room.game_id,
        userId: user?.id,
        roomId: room.id,
        payload: { playerId: readyPlayerId, ready: true },
      });
    }

    return NextResponse.json({ ok: true, isReady, playerId: readyPlayerId });
  }

  if (action === "start") {
    const result = await startDuelRound({
      roomId: room.id,
      gameId: room.game_id,
      hostUserId: user?.id,
      hostPlayerId: playerId,
      guestName,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        need_two_players: "São necessários 2 jogadores.",
        all_must_be_ready: "Todos os jogadores devem estar prontos.",
        host_only: "Apenas o anfitrião pode iniciar.",
        room_update_failed: "Não foi possível sincronizar a sala. Executa a migration room_update_function no Supabase.",
      };
      return NextResponse.json(
        {
          error: messages[result.error] ?? "Não foi possível iniciar.",
          detail: result.error,
        },
        { status: 400 }
      );
    }

    const { data: game } = await supabase
      .from("games")
      .select("slug")
      .eq("id", room.game_id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      status: "playing",
      metadata: result.metadata,
      playUrl: `/games/${game?.slug ?? "reaction-duel"}/play?room=${normalized}`,
    });
  }

  if (action === "click") {
    if (!playerId || !clickedAt) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const result = await submitDuelClick({
      roomId: room.id,
      gameId: room.game_id,
      playerId,
      clickedAt,
      userId: user?.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Clique inválido" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      metadata: result.metadata,
      phase: result.phase,
      result: result.result,
      stats: result.stats ?? null,
    });
  }

  if (action === "record_stats") {
    const stats = await ensureDuelRoundStats({
      roomId: room.id,
      gameId: room.game_id,
    });
    return NextResponse.json({ ok: stats.ok, stats });
  }

  if (action === "rematch") {
    const result = await resetDuelRoom({
      roomId: room.id,
      gameId: room.game_id,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "rematch_failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, metadata: result.metadata });
  }

  if (action === "leave") {
    const player = await findRoomPlayer(room.id, {
      userId: user?.id,
      guestName: user ? undefined : guestName,
      playerId,
    });

    if (player) {
      await supabase.from("room_players").delete().eq("id", player.id);
      await logGameEvent({
        eventType: "PLAYER_LEFT",
        gameId: room.game_id,
        userId: user?.id,
        roomId: room.id,
        payload: { playerId: player.id },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
