"use client";

import { Crown, Loader2, RotateCcw } from "lucide-react";

export type ResultEntry = {
  rank: number;
  playerId: string;
  name: string;
  clicks: number;
  isSelf: boolean;
};

type ResultsProps = {
  results: ResultEntry[];
  loading: boolean;
  isHost: boolean;
  onPlayAgain: () => void;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function Results({ results, loading, isHost, onPlayAgain }: ResultsProps) {
  const winner = results.find((r) => r.rank === 1);

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-premium)] border border-border bg-gradient-to-br from-primary/10 to-secondary/10 p-6 text-center">
        <Crown className="mx-auto size-8 text-warning" aria-hidden />
        <h2 className="mt-2 text-lg font-bold">Fim de jogo!</h2>
        {winner ? (
          <p className="mt-1 text-muted-foreground">
            Vencedor: <span className="font-semibold text-foreground">{winner.name}</span>{" "}
            com {winner.clicks} cliques
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Sem cliques registados.</p>
        )}
      </div>

      <ul className="space-y-2" aria-label="Classificação final">
        {results.map((entry) => (
          <li
            key={entry.playerId}
            className={`flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 ${
              entry.isSelf
                ? "bg-primary/10 ring-1 ring-primary/30"
                : "bg-surface border border-border"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-8 text-center text-lg">
                {MEDALS[entry.rank - 1] ?? `${entry.rank}º`}
              </span>
              <span className="font-medium">
                {entry.name}
                {entry.isSelf ? " (tu)" : ""}
              </span>
            </span>
            <span className="font-bold tabular-nums">{entry.clicks}</span>
          </li>
        ))}
        {results.length === 0 && (
          <li className="text-center text-muted-foreground">A calcular resultados…</li>
        )}
      </ul>

      <button
        type="button"
        onClick={onPlayAgain}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="size-4" aria-hidden />
        )}
        {isHost ? "Jogar novamente" : "Voltar ao lobby"}
      </button>
    </div>
  );
}
