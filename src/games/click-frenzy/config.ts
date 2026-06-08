import type { GameConfigSpec } from "@/lib/partyup-sdk/types";

export const clickFrenzyConfig: GameConfigSpec = {
  name: "Click Frenzy",
  slug: "click-frenzy",
  version: "1.0.0",
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
  minPlayers: 1,
  maxPlayers: 8,
};
