import type { DuelRoomMetadata } from "@/lib/rooms/duel-state";
import type { RoomPlayer } from "@/types/platform";

export async function fetchDuelRoomState(code: string) {
  const res = await fetch(`/api/rooms?code=${encodeURIComponent(code)}`);
  if (!res.ok) return null;

  return (await res.json()) as {
    room: {
      id: string;
      status: string;
      metadata: DuelRoomMetadata;
    };
    players: RoomPlayer[];
  };
}

export async function submitDuelClick(code: string, playerId: string, clickedAt: number) {
  const res = await fetch("/api/rooms", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      action: "click",
      playerId,
      clickedAt,
    }),
  });

  if (!res.ok) return null;
  return res.json();
}
