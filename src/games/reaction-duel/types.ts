import type { DuelPhase, DuelPlayerResult } from "@/lib/rooms/duel-state";

export type { DuelPhase, DuelPlayerResult };

export type ReactionDuelProps = {
  roomCode: string;
  gameId: string;
  userId?: string;
  isGuest: boolean;
  sdk: import("@/lib/partyup-sdk").PartyUpSDK;
};
