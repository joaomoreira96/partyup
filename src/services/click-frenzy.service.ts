import { createClient } from "@/lib/supabase/server";
import { getHostPlayer } from "@/lib/rooms/host";
import { listRoomPlayers } from "@/services/room-actions.service";
import { logGameEvent } from "@/services/event.service";
import { recordPlaySession } from "@/services/stats.service";
import {
  CLICK_FRENZY_DURATION_MS,
  CLICK_FRENZY_MAX_CLICKS,
  createCountdownClickFrenzyMetadata,
  createInitialClickFrenzyMetadata,
  deriveClickFrenzyPhase,
  parseClickFrenzyMetadata,
  rankClickFrenzyScores,
  type ClickFrenzyMetadata,
} from "@/lib/rooms/click-frenzy-state";

async function persistRoomState(
  roomId: string,
  opts: { status?: string; metadata?: ClickFrenzyMetadata }
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_game_room", {
    p_room_id: roomId,
    p_status: opts.status ?? null,
    p_metadata: opts.metadata ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

async function fetchRoomById(roomId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_room_by_id", {
    p_room_id: roomId,
  });
  if (error || !data || typeof data !== "object") return null;
  return data as {
    id: string;
    metadata?: unknown;
    status?: string;
    host_user_id?: string | null;
  };
}

export async function startClickFrenzy(input: {
  roomId: string;
  gameId: string;
  hostUserId?: string | null;
  hostPlayerId?: string;
}) {
  const players = await listRoomPlayers(input.roomId);

  if (players.length < 1) {
    return { ok: false as const, error: "need_player" };
  }
  if (!players.every((p) => p.is_ready === true)) {
    return { ok: false as const, error: "all_must_be_ready" };
  }

  const room = await fetchRoomById(input.roomId);
  const hostPlayer = getHostPlayer(players, room?.host_user_id);
  const isHost =
    (input.hostPlayerId && hostPlayer?.id === input.hostPlayerId) ||
    (input.hostUserId && room?.host_user_id === input.hostUserId);

  if (!isHost) {
    return { ok: false as const, error: "host_only" };
  }

  const metadata = createCountdownClickFrenzyMetadata();

  const saved = await persistRoomState(input.roomId, {
    status: "playing",
    metadata,
  });
  if (!saved.ok) {
    return { ok: false as const, error: saved.error ?? "room_update_failed" };
  }

  await logGameEvent({
    eventType: "GAME_STARTED",
    gameId: input.gameId,
    userId: input.hostUserId ?? undefined,
    roomId: input.roomId,
    payload: { roundId: metadata.roundId, source: "click-frenzy" },
  });

  return { ok: true as const, metadata };
}

export async function submitClickFrenzyScore(input: {
  roomId: string;
  playerId: string;
  clicks: number;
  lastClickAt: number;
}) {
  const supabase = await createClient();
  const clicks = Math.min(
    Math.max(0, Math.round(input.clicks)),
    CLICK_FRENZY_MAX_CLICKS
  );

  const { data, error } = await supabase.rpc("click_frenzy_submit", {
    p_room_id: input.roomId,
    p_player_id: input.playerId,
    p_clicks: clicks,
    p_last_click_at: Math.max(0, Math.round(input.lastClickAt)),
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, metadata: parseClickFrenzyMetadata(data) };
}

export async function finishClickFrenzy(input: {
  roomId: string;
  gameId: string;
}) {
  const room = await fetchRoomById(input.roomId);
  if (!room) return { ok: false as const, error: "room_not_found" };

  const metadata = parseClickFrenzyMetadata(room.metadata);

  if (metadata.recorded) {
    return { ok: true as const, metadata, alreadyRecorded: true };
  }

  // So fecha apos o tempo terminar.
  if (metadata.endAt && Date.now() < metadata.endAt) {
    return { ok: false as const, error: "not_finished", metadata };
  }

  const players = await listRoomPlayers(input.roomId);
  const ranked = rankClickFrenzyScores(metadata.scores);
  const rankByPlayer = new Map(ranked.map((r) => [r.playerId, r.rank]));

  const details: Array<{ playerId: string; userId: string | null; ok: boolean }> = [];

  for (const player of players) {
    const score = metadata.scores[player.id];
    const clicks = score?.clicks ?? 0;
    const placement = rankByPlayer.get(player.id) ?? players.length;

    const result = await recordPlaySession({
      gameId: input.gameId,
      userId: player.user_id ?? undefined,
      result: { score: clicks, durationMs: CLICK_FRENZY_DURATION_MS },
      sessionMetadata: {
        source: "click-frenzy",
        roundId: metadata.roundId,
        roomId: input.roomId,
        playerId: player.id,
        placement,
      },
    });

    details.push({
      playerId: player.id,
      userId: player.user_id ?? null,
      ok: result.ok,
    });

    if (!result.ok) {
      console.error(
        "[finishClickFrenzy] recordPlaySession failed:",
        player.id,
        result.error
      );
    }
  }

  const finalMetadata: ClickFrenzyMetadata = {
    ...metadata,
    phase: "results",
    recorded: true,
  };

  await persistRoomState(input.roomId, {
    status: "finished",
    metadata: finalMetadata,
  });

  await logGameEvent({
    eventType: "GAME_FINISHED",
    gameId: input.gameId,
    roomId: input.roomId,
    payload: {
      roundId: metadata.roundId,
      source: "click-frenzy",
      results: ranked,
    },
  });

  return { ok: true as const, metadata: finalMetadata, details };
}

export async function resetClickFrenzy(input: { roomId: string }) {
  const metadata = createInitialClickFrenzyMetadata();

  const saved = await persistRoomState(input.roomId, {
    status: "waiting",
    metadata,
  });
  if (!saved.ok) {
    return { ok: false as const, error: saved.error, metadata };
  }

  const supabase = await createClient();
  const players = await listRoomPlayers(input.roomId);
  await Promise.all(
    players.map((player) =>
      supabase.rpc("set_room_player_ready", {
        p_player_id: player.id,
        p_is_ready: false,
      })
    )
  );

  return { ok: true as const, metadata };
}

export { deriveClickFrenzyPhase };
