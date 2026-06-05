import type { GameConfigSpec } from "@/lib/partyup-sdk/types";

export const reactionDuelConfig: GameConfigSpec = {
  name: "Reaction Duel",
  slug: "reaction-duel",
  version: "1.0.0",
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
  minPlayers: 2,
  maxPlayers: 2,
};
