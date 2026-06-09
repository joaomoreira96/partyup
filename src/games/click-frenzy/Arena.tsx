"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { MousePointerClick } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";

export type ArenaLiveEntry = {
  playerId: string;
  name: string;
  clicks: number;
  isSelf: boolean;
};

type ArenaProps = {
  timeLeftMs: number;
  score: number;
  position: number;
  totalPlayers: number;
  ranking: ArenaLiveEntry[];
  disabled: boolean;
  onTap: () => void;
};

export function Arena({
  timeLeftMs,
  score,
  position,
  totalPlayers,
  ranking,
  disabled,
  onTap,
}: ArenaProps) {
  const { t } = useI18n();
  const seconds = Math.max(0, Math.ceil(timeLeftMs / 1000));

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!disabled) onTap();
  }

  return (
    <div className="flex select-none flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">
          {t("clickFrenzy.timeLeft")}
        </span>
        <span
          className={`text-2xl font-black tabular-nums ${
            seconds <= 3 ? "text-destructive" : "text-foreground"
          }`}
          aria-live="polite"
        >
          {seconds}s
        </span>
      </div>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        disabled={disabled}
        aria-label={t("clickFrenzy.tapAria")}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        className="relative flex aspect-square w-[min(72vw,260px)] min-h-[200px] min-w-[200px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-xl outline-none transition-transform duration-75 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-ring"
      >
        <span className="flex flex-col items-center gap-2">
          <MousePointerClick className="size-12" aria-hidden />
          <span className="text-5xl font-black tabular-nums">{score}</span>
        </span>
      </button>

      <div className="flex w-full items-center justify-center gap-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("clickFrenzy.score")}
          </p>
          <p className="text-xl font-bold tabular-nums">{score}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("clickFrenzy.position")}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {t("clickFrenzy.positionValue", { position, total: totalPlayers })}
          </p>
        </div>
      </div>

      {ranking.length > 1 && (
        <ul
          className="w-full space-y-1.5 text-sm"
          aria-label={t("clickFrenzy.finalRanking")}
        >
          {ranking.map((entry, index) => (
            <li
              key={entry.playerId}
              className={`flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 ${
                entry.isSelf ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface"
              }`}
            >
              <span className="truncate">
                {index + 1}. {entry.name}
                {entry.isSelf ? t("clickFrenzy.you") : ""}
              </span>
              <span className="font-semibold tabular-nums">{entry.clicks}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
