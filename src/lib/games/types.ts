import type { PartyUpSDK } from "@/lib/partyup-sdk";
import type { Locale } from "@/i18n/config";
import type { GameSessionResult, LeaderboardMetric } from "@/types/platform";

/** @deprecated Use SDK via GameMountContext.sdk */
export type LegacyGameMountContext = {
  container: HTMLElement;
  displayName: string;
  userId?: string;
  isGuest: boolean;
  roomId?: string;
  multiplayer?: boolean;
  onScoreUpdate?: (score: number) => void;
  onSessionEnd?: (result: GameSessionResult) => void;
};

/** Contract every game module must implement (Documento 05). */
export interface GameMountContext {
  container: HTMLElement;
  displayName: string;
  /** PartyUp SDK — única forma de comunicar com a plataforma */
  sdk: PartyUpSDK;
  userId?: string;
  isGuest: boolean;
  roomId?: string;
  multiplayer?: boolean;
  /** Locale activo — jogos imperativos usam createGameMountI18n(locale). */
  locale: Locale;
}

export interface GameModule {
  id: string;
  config?: import("@/lib/partyup-sdk/types").GameConfigSpec;
  mount: (context: GameMountContext) => () => void;
}

export type GameModuleLoader = () => Promise<{ default: GameModule }>;

export interface GameModuleRegistration {
  id: string;
  loader: GameModuleLoader;
}

export function formatScoreForMetric(
  score: number,
  metric: LeaderboardMetric = "score"
): string {
  if (metric === "time") {
    return `${(score / 1000).toFixed(2)}s`;
  }
  return Math.round(score).toLocaleString("pt-PT");
}
