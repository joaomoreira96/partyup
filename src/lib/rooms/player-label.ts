import type { RoomPlayer } from "@/types/platform";

export function roomPlayerLabel(player: RoomPlayer): string {
  if (player.profile?.display_name?.trim()) return player.profile.display_name.trim();
  if (player.profile?.username?.trim()) return player.profile.username.trim();
  if (player.guest_name?.trim()) return player.guest_name.trim();
  return "Jogador";
}
