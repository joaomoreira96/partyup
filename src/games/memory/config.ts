import type { GameConfigSpec } from "@/lib/partyup-sdk/types";

export const memoryConfig: GameConfigSpec = {
  name: "Memória Clássica",
  slug: "memoria-classica",
  version: "1.0.0",
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
  minPlayers: 1,
  maxPlayers: 8,
};
