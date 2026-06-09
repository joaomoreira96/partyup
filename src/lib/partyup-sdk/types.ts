import type { GameSessionResult, LeaderboardMetric, Room, RoomPlayer } from "@/types/platform";

/** Documento 05 — lifecycle obrigatório */
export type GameLifecycleState =
  | "LOAD"
  | "READY"
  | "START"
  | "PLAYING"
  | "FINISHED"
  | "RESULTS";

/** Eventos emitidos pelos jogos */
export type GameSdkEventType =
  | "GAME_LOADED"
  | "GAME_STARTED"
  | "GAME_PAUSED"
  | "GAME_RESUMED"
  | "GAME_FINISHED"
  | "ACHIEVEMENT_UNLOCKED"
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "ROOM_CREATED"
  | "ROOM_JOINED"
  | "ROOM_STARTED"
  | "SCORE_UPDATED"
  | "SCORE_SUBMITTED";

export type SdkUnlockedAchievement = {
  id: string;
  code?: string;
  name: string;
  description: string;
  icon: string | null;
  points?: number;
};

export type EndGameResult = {
  ranked: boolean;
  unlockedAchievements: SdkUnlockedAchievement[];
};

export type AchievementHint =
  | "FIRST_WIN"
  | "PERFECT_SCORE"
  | "SPEED_RUN"
  | "GAMES_100";

export interface GameConfigSpec {
  name: string;
  slug: string;
  version: string;
  supportsMobile: boolean;
  supportsTablet: boolean;
  supportsDesktop: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export interface PartyUpUser {
  id?: string;
  displayName: string;
  isGuest: boolean;
}

export interface PartyUpRoomContext {
  code: string;
  id?: string;
  status: Room["status"];
  players: RoomPlayer[];
  hostUserId?: string | null;
}

export interface SDKInitOptions {
  gameId: string;
  /** Slug estável para resolver o UUID na BD (ex.: memoria-classica). */
  gameSlug: string;
  moduleId: string;
  user: PartyUpUser;
  room?: PartyUpRoomContext;
  metric?: LeaderboardMetric;
  maxScore?: number;
  minScore?: number;
  onLifecycleChange?: (state: GameLifecycleState) => void;
  onEvent?: (type: GameSdkEventType, payload?: Record<string, unknown>) => void;
  onScoreUpdate?: (score: number) => void;
}

export interface EndGamePayload extends GameSessionResult {
  achievementHints?: AchievementHint[];
  events?: Record<string, unknown>;
}

export interface SubmitScorePayload {
  score: number;
  metric?: LeaderboardMetric;
}

export type SdkErrorCode =
  | "NETWORK"
  | "VALIDATION"
  | "ROOM_FORBIDDEN"
  | "NOT_AUTHENTICATED"
  | "UNKNOWN";

export class PartyUpSdkError extends Error {
  constructor(
    message: string,
    public code: SdkErrorCode,
    public userMessage: string
  ) {
    super(message);
    this.name = "PartyUpSdkError";
  }
}
