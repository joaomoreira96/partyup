import type { PartyUpSDK } from "@/lib/partyup-sdk";

export type ClickFrenzyGameProps = {
  roomCode: string;
  gameId: string;
  userId?: string;
  isGuest: boolean;
  sdk: PartyUpSDK;
};
