import { getGuestId } from "@/lib/guest";
import { sdkLogger } from "@/lib/partyup-sdk/logger";
import {
  PartyUpSdkError,
  type EndGamePayload,
  type EndGameResult,
  type GameLifecycleState,
  type GameSdkEventType,
  type SdkUnlockedAchievement,
  type PartyUpRoomContext,
  type PartyUpUser,
  type SDKInitOptions,
  type SubmitScorePayload,
} from "@/lib/partyup-sdk/types";
import {
  validateEndGamePayload,
  validateSubmitScorePayload,
} from "@/lib/partyup-sdk/validation";

/**
 * PartyUp SDK — única porta de comunicação entre jogos e plataforma (Doc 05).
 * Jogos NUNCA contactam Supabase diretamente.
 */
export class PartyUpSDK {
  private state: GameLifecycleState = "LOAD";
  private sessionStarted = false;
  private sessionEnded = false;

  constructor(private readonly options: SDKInitOptions) {
    this.transition("LOAD");
    this.emit("GAME_LOADED");
    this.transition("READY");
  }

  getLifecycleState(): GameLifecycleState {
    return this.state;
  }

  getGameId(): string {
    return this.options.gameId;
  }

  getModuleId(): string {
    return this.options.moduleId;
  }

  getCurrentUser(): PartyUpUser {
    return this.options.user;
  }

  getCurrentRoom(): PartyUpRoomContext | undefined {
    return this.options.room;
  }

  transition(next: GameLifecycleState) {
    this.state = next;
    this.options.onLifecycleChange?.(next);
    sdkLogger.debug("lifecycle", { state: next, gameId: this.options.gameId });
  }

  emit(type: GameSdkEventType, payload?: Record<string, unknown>) {
    this.options.onEvent?.(type, payload);
    sdkLogger.debug("event", { type, gameId: this.options.gameId });
  }

  async startGame(): Promise<void> {
    if (this.sessionStarted && !this.sessionEnded) return;

    if (this.sessionEnded) {
      this.sessionStarted = false;
      this.sessionEnded = false;
      this.transition("READY");
    }

    try {
      const res = await fetch("/api/sdk/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.options.gameId,
          gameSlug: this.options.gameSlug,
          guestId: this.options.user.isGuest ? getGuestId() : undefined,
          roomCode: this.options.room?.code,
        }),
      });

      if (!res.ok) {
        throw new Error("start_failed");
      }

      this.sessionStarted = true;
      this.transition("START");
      this.transition("PLAYING");
      this.emit("GAME_STARTED");
      if (this.options.room) {
        this.emit("ROOM_STARTED", { code: this.options.room.code });
      }
    } catch (err) {
      sdkLogger.error("startGame failed", { err });
      throw new PartyUpSdkError(
        String(err),
        "NETWORK",
        "Não foi possível iniciar o jogo. Tenta novamente."
      );
    }
  }

  /** Atualiza a UI durante o jogo sem chamar a API (ranking final em endGame). */
  reportScore(score: number): void {
    this.options.onScoreUpdate?.(score);
    this.emit("SCORE_UPDATED", { score });
  }

  async submitScore(payload: SubmitScorePayload): Promise<void> {
    const check = validateSubmitScorePayload(payload, {
      metric: payload.metric ?? this.options.metric,
      maxScore: this.options.maxScore,
      minScore: this.options.minScore,
    });

    if (!check.ok) {
      throw new PartyUpSdkError(check.reason, "VALIDATION", check.userMessage);
    }

    this.options.onScoreUpdate?.(payload.score);
    this.emit("SCORE_SUBMITTED", { score: payload.score });

    if (!this.options.user.id) return;

    try {
      const res = await fetch("/api/sdk/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.options.gameId,
          gameSlug: this.options.gameSlug,
          score: payload.score,
          metric: payload.metric ?? this.options.metric,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "submit_failed");
      }
    } catch (err) {
      sdkLogger.error("submitScore failed", { err });
      throw new PartyUpSdkError(
        String(err),
        "NETWORK",
        "Não foi possível guardar a pontuação."
      );
    }
  }

  async endGame(payload: EndGamePayload): Promise<EndGameResult> {
    if (this.sessionEnded) {
      return { ranked: false, unlockedAchievements: [] };
    }

    const check = validateEndGamePayload(payload, {
      metric: payload.metric ?? this.options.metric,
      maxScore: this.options.maxScore,
      minScore: this.options.minScore,
    });

    if (!check.ok) {
      throw new PartyUpSdkError(check.reason, "VALIDATION", check.userMessage);
    }

    try {
      const res = await fetch("/api/sdk/game/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.options.gameId,
          gameSlug: this.options.gameSlug,
          guestId: this.options.user.isGuest ? getGuestId() : undefined,
          result: {
            score: payload.score,
            durationMs: payload.durationMs,
            metric: payload.metric ?? this.options.metric,
          },
          submitScore: !this.options.user.isGuest && Boolean(this.options.user.id),
          achievementHints: payload.achievementHints,
          events: payload.events,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "end_failed");
      }

      const data = (await res.json()) as {
        ranked?: boolean;
        unlockedAchievements?: SdkUnlockedAchievement[];
      };

      const result: EndGameResult = {
        ranked: Boolean(data.ranked),
        unlockedAchievements: data.unlockedAchievements ?? [],
      };

      this.sessionEnded = true;
      this.transition("FINISHED");
      this.emit("GAME_FINISHED", { score: payload.score });
      for (const achievement of result.unlockedAchievements) {
        this.emit("ACHIEVEMENT_UNLOCKED", { achievement });
      }
      this.transition("RESULTS");
      return result;
    } catch (err) {
      sdkLogger.error("endGame failed", { err });
      throw new PartyUpSdkError(
        String(err),
        "NETWORK",
        "Não foi possível guardar o resultado."
      );
    }
  }

  /** Multiplayer é da plataforma — jogos não criam salas (Doc 05 §11). */
  async createRoom(): Promise<never> {
    throw new PartyUpSdkError(
      "games_cannot_create_rooms",
      "ROOM_FORBIDDEN",
      "As salas são criadas pela plataforma PartyUp, não pelo jogo."
    );
  }

  async joinRoom(): Promise<never> {
    throw new PartyUpSdkError(
      "games_cannot_join_rooms",
      "ROOM_FORBIDDEN",
      "Entra na sala através do link partilhado pela plataforma."
    );
  }

  async leaveRoom(): Promise<void> {
    const room = this.options.room;
    if (!room?.code) return;

    try {
      await fetch("/api/sdk/room/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: room.code }),
      });
      this.emit("PLAYER_LEFT", { code: room.code });
    } catch (err) {
      sdkLogger.warn("leaveRoom failed", { err });
    }
  }
}

export function createPartyUpSDK(options: SDKInitOptions): PartyUpSDK {
  return new PartyUpSDK(options);
}
