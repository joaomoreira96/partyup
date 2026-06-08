"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { MousePointerClick } from "lucide-react";

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
  const seconds = Math.max(0, Math.ceil(timeLeftMs / 1000));

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    // Resposta imediata e fiavel em desktop e mobile (evita atraso do click).
    e.preventDefault();
    if (!disabled) onTap();
  }

  return (
    <div className="flex select-none flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">Tempo restante</span>
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
        aria-label="Clica para somar pontos"
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
            Pontuação
          </p>
          <p className="text-xl font-bold tabular-nums">{score}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Posição
          </p>
          <p className="text-xl font-bold tabular-nums">
            {position}º / {totalPlayers}
          </p>
        </div>
      </div>

      {ranking.length > 1 && (
        <ul className="w-full space-y-1.5 text-sm" aria-label="Classificação ao vivo">
          {ranking.map((entry, index) => (
            <li
              key={entry.playerId}
              className={`flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 ${
                entry.isSelf ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface"
              }`}
            >
              <span className="truncate">
                {index + 1}. {entry.name}
                {entry.isSelf ? " (tu)" : ""}
              </span>
              <span className="font-semibold tabular-nums">{entry.clicks}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
