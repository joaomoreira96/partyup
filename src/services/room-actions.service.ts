import { createClient } from "@/lib/supabase/server";
import {
  createCountdownMetadata,
  createInitialDuelMetadata,
  parseDuelMetadata,
  type DuelRoomMetadata,
  phaseFromTimestamps,
  reactionScore,
} from "@/lib/rooms/duel-state";
import {
  countUniqueResults,
  isRoundComplete,
  mergeDuelResults,
  resolveResultsNeeded,
  withRoundPhase,
} from "@/lib/rooms/round-completion";
import { getHostPlayer } from "@/lib/rooms/host";
import { normalizeRoomPlayer } from "@/lib/rooms/normalize-player";
import { roomPlayerLabel } from "@/lib/rooms/player-label";
import { logGameEvent } from "@/services/event.service";
import { recordDuelRoomSessions } from "@/services/stats.service";
import type { RoomPlayer } from "@/types/platform";

export { parseDuelMetadata };

async function persistRoomState(
  roomId: string,
  opts: { status?: string; metadata?: DuelRoomMetadata }
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_game_room", {
    p_room_id: roomId,
    p_status: opts.status ?? null,
    p_metadata: opts.metadata ?? null,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

async function fetchRoomById(roomId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_room_by_id", {
    p_room_id: roomId,
  });

  if (error || !data || typeof data !== "object") {
    return null;
  }

  return data as { id: string; metadata?: unknown; status?: string; host_user_id?: string | null };
}

export function gameSupportsMultiplayer(game: Record<string, unknown>): boolean {
  if (typeof game.supports_multiplayer === "boolean") return game.supports_multiplayer;
  if (typeof game.is_multiplayer === "boolean") return game.is_multiplayer;
  return false;
}

export async function findRoomPlayer(
  roomId: string,
  opts: { userId?: string | null; guestName?: string | null; playerId?: string }
) {
  const players = await listRoomPlayers(roomId);

  if (opts.playerId) {
    const match = players.find((p) => p.id === opts.playerId);
    if (match) return match;
  }

  if (opts.userId) {
    const match = players.find((p) => p.user_id === opts.userId);
    if (match) return match;
  }

  if (opts.guestName) {
    const match = players.find(
      (p) => !p.user_id && p.guest_name === opts.guestName
    );
    if (match) return match;
  }

  return null;
}

export async function listRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const supabase = await createClient();

  const { data: rpcRows, error: rpcError } = await supabase.rpc("list_room_players", {
    p_room_id: roomId,
  });

  let players: RoomPlayer[] = [];

  if (!rpcError && Array.isArray(rpcRows)) {
    players = rpcRows.map((row) =>
      normalizeRoomPlayer(row as Record<string, unknown>)
    );
  } else {
    const { data: rows } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId);

    players = (rows ?? []).map((row) =>
      normalizeRoomPlayer(row as Record<string, unknown>)
    );
  }
  const userIds = [
    ...new Set(players.map((p) => p.user_id).filter((id): id is string => !!id)),
  ];

  if (userIds.length === 0) return players;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        display_name: p.display_name as string,
        username: p.username as string | null,
      },
    ])
  );

  return players.map((player) => ({
    ...player,
    profile: player.user_id ? profileById.get(player.user_id) : undefined,
  }));
}

export function playerDisplayName(player: RoomPlayer): string {
  return roomPlayerLabel(player);
}

function roundContext(playerCount: number, maxPlayers = 2) {
  return { playerCount, maxPlayers };
}

export type DuelStatsRecordResult = Awaited<
  ReturnType<typeof recordDuelRoomSessions>
> & {
  skipped?: boolean;
  reason?: string;
};

export async function ensureDuelRoundStats(input: {
  roomId: string;
  gameId: string;
  metadataSnapshot?: DuelRoomMetadata;
}): Promise<DuelStatsRecordResult> {
  const players = await listRoomPlayers(input.roomId);
  const ctx = roundContext(players.length);

  let metadata = input.metadataSnapshot;
  let roomStatus: string | undefined;

  if (!metadata) {
    const room = await fetchRoomById(input.roomId);
    if (!room) {
      return {
        ok: false as const,
        error: "room_not_found",
        recorded: 0,
        details: [],
      };
    }
    metadata = parseDuelMetadata(room.metadata);
    roomStatus = room.status;
  }

  const needed = resolveResultsNeeded(metadata, ctx);
  const resultCount = countUniqueResults(metadata.results);

  if (!isRoundComplete(metadata, ctx, { roomStatus })) {
    return {
      ok: true as const,
      recorded: 0,
      details: [],
      skipped: true,
      reason: `round_not_complete (${resultCount}/${needed}, phase=${metadata.phase})`,
    };
  }

  return recordDuelRoomSessions({
    gameId: input.gameId,
    roomId: input.roomId,
    metadata,
    players: players.map((p) => ({ id: p.id, user_id: p.user_id })),
  });
}

export async function submitDuelClick(input: {
  roomId: string;
  gameId: string;
  playerId: string;
  clickedAt: number;
  userId?: string;
}) {
  const players = await listRoomPlayers(input.roomId);
  const player = players.find((p) => p.id === input.playerId);
  if (!player) return { ok: false as const, error: "player_not_found" };

  const room = await fetchRoomById(input.roomId);
  if (!room) return { ok: false as const, error: "room_not_found" };

  let metadata = parseDuelMetadata(room.metadata);
  const ctx = roundContext(players.length);

  const existing = metadata.results.find((r) => r.playerId === input.playerId);
  if (existing) {
    const complete = withRoundPhase(metadata, ctx);
    const stats = await ensureDuelRoundStats({
      roomId: input.roomId,
      gameId: input.gameId,
      metadataSnapshot: complete,
    });
    return {
      ok: true as const,
      metadata: complete,
      phase: phaseFromTimestamps(complete, input.clickedAt, ctx),
      result: existing,
      stats,
    };
  }

  let tooEarly = false;
  let reactionMs: number | null = null;
  let score = 0;

  if (!metadata.greenAt || input.clickedAt < metadata.greenAt) {
    tooEarly = true;
  } else {
    reactionMs = input.clickedAt - metadata.greenAt;
    score = reactionScore(reactionMs);
  }

  const result = {
    playerId: input.playerId,
    displayName: playerDisplayName(player),
    reactionMs,
    tooEarly,
    score,
  };

  // Re-lê antes de gravar para fundir cliques simultâneos sem perder resultados.
  const latestRoom = await fetchRoomById(input.roomId);
  if (latestRoom) {
    metadata = parseDuelMetadata(latestRoom.metadata);
  }

  const duplicate = metadata.results.find((r) => r.playerId === input.playerId);
  if (duplicate) {
    const complete = withRoundPhase(metadata, ctx);
    const stats = await ensureDuelRoundStats({
      roomId: input.roomId,
      gameId: input.gameId,
      metadataSnapshot: complete,
    });
    return {
      ok: true as const,
      metadata: complete,
      phase: phaseFromTimestamps(complete, input.clickedAt, ctx),
      result: duplicate,
      stats,
    };
  }

  metadata.results = mergeDuelResults(metadata.results, [result]);

  if (!tooEarly && !metadata.winnerPlayerId) {
    metadata.winnerPlayerId = input.playerId;
  }

  metadata = withRoundPhase(metadata, ctx);

  const saved = await persistRoomState(input.roomId, {
    metadata,
    status: metadata.phase === "results" ? "finished" : "playing",
  });
  if (!saved.ok) {
    return { ok: false as const, error: saved.error ?? "room_update_failed" };
  }

  await logGameEvent({
    eventType: "SCORE_SUBMITTED",
    gameId: input.gameId,
    userId: input.userId,
    roomId: input.roomId,
    payload: { playerId: input.playerId, reactionMs, tooEarly, score },
  });

  let stats: DuelStatsRecordResult | undefined;

  if (isRoundComplete(metadata, ctx)) {
    await logGameEvent({
      eventType: "GAME_FINISHED",
      gameId: input.gameId,
      userId: input.userId,
      roomId: input.roomId,
      payload: { winnerPlayerId: metadata.winnerPlayerId, results: metadata.results },
    });

    stats = await ensureDuelRoundStats({
      roomId: input.roomId,
      gameId: input.gameId,
      metadataSnapshot: metadata,
    });

    if (!stats.ok) {
      console.error(
        "[submitDuelClick] ensureDuelRoundStats failed:",
        stats.error
      );
    }
  }

  return {
    ok: true as const,
    metadata,
    phase: phaseFromTimestamps(metadata, input.clickedAt, ctx),
    result,
    stats,
  };
}

export async function startDuelRound(input: {
  roomId: string;
  gameId: string;
  hostUserId?: string | null;
  hostPlayerId?: string;
  guestName?: string;
}) {
  const players = await listRoomPlayers(input.roomId);

  if (players.length < 2) {
    return { ok: false as const, error: "need_two_players" };
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

  const maxPlayers = 2;
  const activePlayerIds = players
    .filter((p) => p.is_ready === true)
    .slice(0, maxPlayers)
    .map((p) => p.id);
  const metadata: DuelRoomMetadata = {
    ...createCountdownMetadata(),
    activePlayerIds,
    resultsNeeded: Math.min(activePlayerIds.length, maxPlayers),
  };

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
    payload: { roundId: metadata.roundId },
  });

  return { ok: true as const, metadata };
}

export async function resetDuelRoom(input: { roomId: string; gameId: string }) {
  const metadata = createInitialDuelMetadata();

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
