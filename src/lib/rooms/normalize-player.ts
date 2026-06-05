import type { RoomPlayer } from "@/types/platform";

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "t";
}

export function normalizeRoomPlayer(
  row: Record<string, unknown>,
  existing?: RoomPlayer
): RoomPlayer {
  const hasReady = Object.prototype.hasOwnProperty.call(row, "is_ready");
  const hasHost = Object.prototype.hasOwnProperty.call(row, "is_host");

  return {
    id: String(row.id),
    room_id: String(row.room_id),
    user_id: (row.user_id as string | null) ?? null,
    guest_name: (row.guest_name as string | null) ?? existing?.guest_name ?? null,
    is_ready: hasReady ? asBool(row.is_ready) : (existing?.is_ready ?? false),
    is_host: hasHost ? asBool(row.is_host) : (existing?.is_host ?? false),
    joined_at: String(
      row.joined_at ?? existing?.joined_at ?? new Date().toISOString()
    ),
    profile: existing?.profile,
  };
}

export function mergePlayerRow(
  players: RoomPlayer[],
  row: Record<string, unknown>
): RoomPlayer[] {
  const id = String(row.id);
  const index = players.findIndex((p) => p.id === id);
  const existing = index === -1 ? undefined : players[index];
  const normalized = normalizeRoomPlayer(row, existing);

  if (index === -1) {
    return [...players, normalized];
  }

  const next = [...players];
  next[index] = normalized;
  return next;
}

export function mergePlayerLists(
  incoming: RoomPlayer[],
  existing: RoomPlayer[]
): RoomPlayer[] {
  const existingById = new Map(existing.map((p) => [p.id, p]));

  return incoming.map((row) =>
    normalizeRoomPlayer(row as unknown as Record<string, unknown>, existingById.get(row.id))
  );
}
