/** Canal único de comunicação iframe ↔ plataforma (Fase 3). */
export const PARTYUP_SDK_SOURCE = "partyup-sdk" as const;

export type PartyUpSdkMessageType =
  | "READY"
  | "INIT"
  | "PING"
  | "CALL"
  | "RESPONSE"
  | "EVENT"
  | "ERROR";

export type PartyUpSdkBridgeMethod =
  | "startGame"
  | "endGame"
  | "submitScore"
  | "reportScore"
  | "getCurrentUser"
  | "getCurrentLanguage"
  | "getCurrentGame"
  | "getCurrentRoom"
  | "createRoom"
  | "joinRoom"
  | "leaveRoom"
  | "sendRoomEvent";

export type PartyUpSdkInitPayload = {
  user: {
    id?: string;
    displayName: string;
    isGuest: boolean;
  };
  language: string;
  game: {
    id: string;
    slug: string;
    name: string;
    version?: string;
    metric?: string;
    maxScore?: number;
  };
  room?: {
    code: string;
    status: string;
    players: unknown[];
  };
  session: {
    id: string;
  };
};

export type PartyUpSdkMessage = {
  source: typeof PARTYUP_SDK_SOURCE;
  type: PartyUpSdkMessageType;
  requestId?: string;
  payload?: Record<string, unknown>;
};

export type PartyUpSdkResponsePayload = {
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    userMessage?: string;
  };
};

export function isPartyUpSdkMessage(data: unknown): data is PartyUpSdkMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as PartyUpSdkMessage;
  return msg.source === PARTYUP_SDK_SOURCE && typeof msg.type === "string";
}

export function parsePartyUpSdkMessage(data: unknown): PartyUpSdkMessage | null {
  return isPartyUpSdkMessage(data) ? data : null;
}
