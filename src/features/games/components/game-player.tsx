"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { resolveGameModuleId } from "@/lib/games/resolve-module-id";
import { loadGameModule } from "@/lib/games/registry";
import { createPartyUpSDK, PartyUpSdkError } from "@/lib/partyup-sdk";
import { getGuestId, getGuestName } from "@/lib/guest";
import { getMaxScoreForModule, getMetricForGame } from "@/lib/games/metrics";
import type { GameRecord } from "@/types/platform";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/page-states";

interface GamePlayerProps {
  game: GameRecord;
  userId?: string;
  userDisplayName?: string;
  isGuest: boolean;
  roomCode?: string;
}

export function GamePlayer({
  game,
  userId,
  userDisplayName,
  isGuest,
  roomCode,
}: GamePlayerProps) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [guestName, setGuestNameState] = useState(() => t("common.guest"));
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const displayName = userDisplayName ?? guestName;

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
    if (isGuest) setGuestNameState(getGuestName());
  }, [isGuest]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    async function mount() {
      setLoading(true);
      setError(null);

      const moduleId = resolveGameModuleId(game);
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
        moduleId,
        metric,
        maxScore: getMaxScoreForModule(moduleId),
        user: {
          id: userId,
          displayName,
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
      });

      const wrapper = document.createElement("div");
      wrapper.className =
        "game-module-root w-full min-h-[240px] [--game-safe-top:env(safe-area-inset-top)]";
      container.innerHTML = "";
      container.appendChild(wrapper);

      try {
        cleanup = module.mount({
          container: wrapper,
          displayName,
          sdk,
          userId,
          isGuest,
          roomId: roomCode,
          multiplayer: Boolean(roomCode),
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
    displayName,
    userId,
    isGuest,
    roomCode,
    showFriendlyError,
    t,
  ]);

  if (!game.guest_allowed && isGuest) {
    return (
      <div className="party-card p-6 text-center">
        <p className="mb-4 text-muted-foreground">{t("games.play.requiresAccount")}</p>
        <Button asChild>
          <Link href="/register">{t("games.play.createAccount")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isGuest && (
        <div className="party-card flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="guest-name">{t("games.play.guestName")}</Label>
            <Input
              id="guest-name"
              defaultValue={guestName}
              onBlur={(e) => {
                const name = e.target.value || t("common.guest");
                localStorage.setItem("partyup_guest_name", name);
                setGuestNameState(name);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:max-w-xs">
            {t("games.play.guestHint")}
          </p>
        </div>
      )}

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
