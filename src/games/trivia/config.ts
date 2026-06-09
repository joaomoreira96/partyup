import type { GameConfigSpec } from "@/lib/partyup-sdk/types";

export const triviaConfig: GameConfigSpec = {
  name: "Trivia Rápida",
  slug: "trivia-rapida",
  version: "1.2.0",
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
  minPlayers: 1,
  maxPlayers: 8,
};
