import type { GameConfigSpec } from "@/lib/partyup-sdk/types";

export const snakeConfig: GameConfigSpec = {
  name: "Snake",
  slug: "snake",
  version: "1.0.0",
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
  minPlayers: 1,
  maxPlayers: 1,
};
