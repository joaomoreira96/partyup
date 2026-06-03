export type UserRole = "user" | "admin";
/** Document 03: draft | active | disabled */
export type GameStatus = "draft" | "active" | "disabled";
/** Legacy alias used in static catalog mapping */
export type LegacyGameStatus = "published" | "archived";
export type RoomStatus = "waiting" | "playing" | "finished";
export type LeaderboardMetric = "score" | "time" | "streak";
export type DeviceCompatibility = "desktop" | "tablet" | "mobile";

export type GameEventType =
  | "GAME_STARTED"
  | "GAME_FINISHED"
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "ROOM_CREATED"
  | "ROOM_JOINED"
  | "SCORE_SUBMITTED"
  | "ACHIEVEMENT_UNLOCKED";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  role: UserRole;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface GameRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnail_url: string | null;
  banner_url: string | null;
  module_id: string;
  guest_allowed: boolean;
  supports_multiplayer: boolean;
  supports_desktop: boolean;
  supports_tablet: boolean;
  supports_mobile: boolean;
  featured?: boolean;
  status: GameStatus;
  categories?: Category[];
  active_build?: GameBuild | null;
}

export interface GameBuild {
  id: string;
  game_id: string;
  version: string;
  build_url: string;
  is_active: boolean;
}

export interface LeaderboardEntry {
  id: string;
  game_id: string;
  user_id: string;
  score: number;
  metric: LeaderboardMetric;
  created_at: string;
  profile?: Pick<Profile, "display_name" | "username" | "avatar_url">;
}

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked_at?: string;
}

export interface UserStats {
  user_id: string;
  total_games_played: number;
  total_play_time_seconds: number;
  total_score: number;
  highest_score: number;
}

export interface GameStats {
  game_id: string;
  total_sessions: number;
  total_players: number;
  total_play_time_seconds: number;
  highest_score: number;
}

export interface Room {
  id: string;
  code: string;
  game_id: string;
  host_user_id: string | null;
  status: RoomStatus;
  max_players: number;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string | null;
  guest_name: string | null;
  is_ready: boolean;
  is_host: boolean;
  joined_at: string;
  profile?: Pick<Profile, "display_name" | "username">;
}

export interface GameSessionResult {
  score: number;
  durationMs: number;
  metric?: LeaderboardMetric;
}

export interface GameEvent {
  id: string;
  event_type: GameEventType;
  game_id: string | null;
  user_id: string | null;
  room_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
