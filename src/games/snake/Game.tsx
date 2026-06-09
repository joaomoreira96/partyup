"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PartyUpSDK } from "@/lib/partyup-sdk";
import { PartyUpSdkError } from "@/lib/partyup-sdk";
import { Button } from "@/components/ui/button";
import { Controls } from "@/games/snake/Controls";
import { GRID_SIZE, SNAKE_SLUG } from "@/games/snake/constants";
import { usePlayerStats } from "@/games/snake/hooks/usePlayerStats";
import { useSnakeGame } from "@/games/snake/hooks/useSnakeGame";
import { SnakeCanvas } from "@/games/snake/SnakeCanvas";
import type { Direction } from "@/games/snake/types";
import { useI18n } from "@/features/i18n/locale-provider";

type GameProps = {
  sdk: PartyUpSDK;
  gameId: string;
  userId?: string;
  isGuest: boolean;
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

export function Game({ sdk, gameId, userId, isGuest }: GameProps) {
  const { t } = useI18n();
  const { stats, setStats } = usePlayerStats(gameId, userId);
  const [ending, setEnding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState(0);

  const handleGameOver = useCallback(
    async (finalState: { score: number }, durationMs: number) => {
      setLastDurationMs(durationMs);
      setEnding(true);
      setSaveError(null);

      try {
        await sdk.endGame({
          score: finalState.score,
          durationMs,
          metric: "score",
          achievementHints: finalState.score > 0 ? ["FIRST_WIN"] : undefined,
        });

        if (!isGuest && finalState.score > stats.bestScore) {
          setStats((prev) => ({
            ...prev,
            bestScore: finalState.score,
          }));
        }

        if (!isGuest && gameId) {
          const res = await fetch(`/api/games/${gameId}/personal-stats`);
          if (res.ok) {
            const data = (await res.json()) as { bestScore: number; rank: number | null };
            setStats({
              bestScore: Number(data.bestScore) || finalState.score,
              rank: data.rank ?? null,
            });
          }
        }
      } catch (err) {
        setSaveError(
          err instanceof PartyUpSdkError
            ? err.userMessage
            : t("gameModules.snake.saveError")
        );
      } finally {
        setEnding(false);
      }
    },
    [sdk, isGuest, gameId, stats.bestScore, setStats, t]
  );

  const { state, handleDirection, startRound, playAgain } = useSnakeGame({
    sdk,
    onGameOver: handleGameOver,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;

      if (state.phase === "PLAYING") {
        event.preventDefault();
        handleDirection(direction);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDirection, state.phase]);

  const displayBest = Math.max(stats.bestScore, state.score);
  const showGame = state.phase !== "IDLE";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 touch-manipulation overscroll-none">
      {!showGame ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-2xl font-bold">{t("gameModules.snake.title")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("gameModules.snake.description")}
          </p>
          {isGuest && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("gameModules.snake.guestHint")}
            </p>
          )}
          <Button className="mt-6 w-full sm:w-auto" size="lg" onClick={() => void startRound()}>
            {t("gameModules.snake.play")}
          </Button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t("gameModules.snake.currentScore")}</p>
              <p className="text-2xl font-bold tabular-nums">{state.score}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">{t("gameModules.snake.personalBest")}</p>
              <p className="text-2xl font-bold tabular-nums">
                {userId ? displayBest : "—"}
              </p>
            </div>
          </div>

          <SnakeCanvas snapshot={{ ...state, gridSize: GRID_SIZE }} />

          <Controls
            onDirection={handleDirection}
            disabled={state.phase !== "PLAYING" || ending}
          />

          <p className="hidden text-center text-xs text-muted-foreground md:block">
            {t("gameModules.snake.keyboardHint")}
          </p>
        </>
      )}

      {state.phase === "GAME_OVER" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snake-game-over-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h3 id="snake-game-over-title" className="text-xl font-bold">
              {t("gameModules.snake.gameOver")}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("gameModules.snake.yourScore")}</dt>
                <dd className="font-semibold tabular-nums">{state.score}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("gameModules.snake.personalBest")}</dt>
                <dd className="font-semibold tabular-nums">
                  {userId ? Math.max(stats.bestScore, state.score) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("gameModules.snake.ranking")}</dt>
                <dd className="font-semibold tabular-nums">
                  {userId && stats.rank ? `#${stats.rank}` : t("gameModules.snake.noRank")}
                </dd>
              </div>
              {lastDurationMs > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("gameModules.snake.duration")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {Math.round(lastDurationMs / 1000)}s
                  </dd>
                </div>
              )}
            </dl>

            {saveError && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={ending}
                onClick={() => void playAgain()}
              >
                {t("gameModules.snake.playAgain")}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/games/${SNAKE_SLUG}`}>{t("gameModules.snake.backToGame")}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
