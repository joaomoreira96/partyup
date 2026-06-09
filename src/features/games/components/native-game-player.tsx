"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { resolveGameModuleId } from "@/lib/games/resolve-module-id";
import { loadGameModule } from "@/lib/games/registry";
import { useGameMusic } from "@/hooks/use-game-music";
import { GameMusicToggle } from "@/features/games/components/game-music-toggle";
import { showAchievementUnlockedToasts } from "@/lib/achievements/show-unlocked-toast";
import { createPartyUpSDK, PartyUpSdkError } from "@/lib/partyup-sdk";
import type { SdkUnlockedAchievement } from "@/lib/partyup-sdk";
import { getGuestName } from "@/lib/guest";
import { endRoomTransition, leaveRoomSession } from "@/lib/rooms/leave-room";
import { getRoomPlayerId } from "@/lib/rooms/player-session";
import { getMaxScoreForModule, getMetricForGame } from "@/lib/games/metrics";
import type { GameRecord } from "@/types/platform";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/page-states";

export type NativeGamePlayerProps = {
  game: GameRecord;
  userId?: string;
  userDisplayName: string;
  isGuest: boolean;
  roomCode?: string;
};

export function NativeGamePlayer({
  game,
  userId,
  userDisplayName,
  isGuest,
  roomCode,
}: NativeGamePlayerProps) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const moduleId = resolveGameModuleId(game);
  const { muted, toggleMuted } = useGameMusic(moduleId);

  const showFriendlyError = useCallback(
    (err: unknown) => {
      if (err instanceof PartyUpSdkError) {
        setError(err.userMessage);
      } else {
        setError(t("games.loadError"));
      }
    },
    [t]
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    async function mount() {
      setLoading(true);
      setError(null);

      const module = await loadGameModule(moduleId);

      if (!module) {
        if (mounted) {
          setError(t("games.unavailable"));
          setLoading(false);
        }
        return;
      }

      const container = containerRef.current;
      if (!container || !mounted) {
        if (mounted) {
          setError(t("games.unavailable"));
          setLoading(false);
        }
        return;
      }

      const metric = getMetricForGame(moduleId);
      const sdk = createPartyUpSDK({
        gameId: game.id,
        gameSlug: game.slug,
        moduleId,
        metric,
        maxScore: getMaxScoreForModule(moduleId),
        user: {
          id: userId,
          displayName: userDisplayName,
          isGuest,
        },
        room: roomCode
          ? { code: roomCode, status: "playing", players: [] }
          : undefined,
        onScoreUpdate: (score) => {
          setStatusHint(t("games.scoreHint", { score: Math.round(score) }));
        },
        onLifecycleChange: (state) => {
          if (state === "PLAYING") setStatusHint(null);
        },
        onEvent: (type, payload) => {
          if (type !== "ACHIEVEMENT_UNLOCKED" || !payload?.achievement) return;
          showAchievementUnlockedToasts(
            [payload.achievement as SdkUnlockedAchievement],
            { title: t("achievements.unlockedTitle") }
          );
        },
      });

      const wrapper = document.createElement("div");
      wrapper.className =
        "game-module-root w-full min-h-[240px] [--game-safe-top:env(safe-area-inset-top)]";
      container.innerHTML = "";
      container.appendChild(wrapper);

      try {
        cleanup = module.mount({
          container: wrapper,
          displayName: userDisplayName,
          sdk,
          userId,
          isGuest,
          roomId: roomCode,
          multiplayer: Boolean(roomCode),
          locale,
        });
      } catch (err) {
        showFriendlyError(err);
      }

      setLoading(false);
    }

    void mount();

    return () => {
      mounted = false;
      const runCleanup = cleanup;
      const container = containerRef.current;
      queueMicrotask(() => {
        runCleanup?.();
        if (container) container.innerHTML = "";
      });
    };
  }, [
    game,
    userDisplayName,
    userId,
    isGuest,
    roomCode,
    locale,
    showFriendlyError,
    t,
    moduleId,
  ]);

  useEffect(() => {
    if (!roomCode) return;

    endRoomTransition(roomCode);

    const onPageHide = () => leaveRoomSession(roomCode, getRoomPlayerId(roomCode));
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      leaveRoomSession(roomCode, getRoomPlayerId(roomCode));
    };
  }, [roomCode]);

  return (
    <div className="space-y-4">
      {statusHint && (
        <p className="text-sm text-muted-foreground" role="status">
          {statusHint}
        </p>
      )}

      {error && (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-4"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="relative w-full">
        <GameMusicToggle muted={muted} onToggle={toggleMuted} />
        {loading && (
          <div className="absolute inset-0 z-10 flex min-h-[280px] items-center justify-center rounded-[var(--radius-premium)] border border-border bg-card/95">
            <LoadingState label={t("games.play.loading")} />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full min-h-[280px] rounded-[var(--radius-premium)] border border-border bg-card p-4"
          aria-label={t("games.play.areaLabel", { name: getGameName(game, locale) })}
          aria-busy={loading}
        />
      </div>
    </div>
  );
}
