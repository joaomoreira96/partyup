import type { GameModuleId } from "@/lib/games/module-ids";

/** CC0 lo-fi tracks from Open Lo-Fi (github.com/btahir/open-lofi) — one per game module. */
export const GAME_MUSIC: Record<GameModuleId, string> = {
  "click-frenzy": "/audio/games/click-frenzy.mp3",
  "reaction-duel": "/audio/games/reaction-duel.mp3",
  snake: "/audio/games/snake.mp3",
  memory: "/audio/games/memory.mp3",
  reaction: "/audio/games/reaction.mp3",
  trivia: "/audio/games/trivia.mp3",
};

export function getGameMusicUrl(moduleId: string): string | null {
  if (moduleId in GAME_MUSIC) {
    return GAME_MUSIC[moduleId as GameModuleId];
  }
  return null;
}
