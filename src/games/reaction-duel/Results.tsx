"use client";

import Link from "next/link";
import { COPY, REACTION_DUEL_SLUG } from "@/games/reaction-duel/constants";
import type { DuelPlayerResult } from "@/lib/rooms/duel-state";
import type { RoomStatsRecordInfo } from "@/hooks/use-room";
import { Button } from "@/components/ui/button";

type ResultsProps = {
  results: DuelPlayerResult[];
  winnerPlayerId: string | null;
  localPlayerId: string | null;
  onPlayAgain: () => void;
  loading?: boolean;
  statsInfo?: RoomStatsRecordInfo | null;
};

function StatsDebugPanel({ stats }: { stats: RoomStatsRecordInfo }) {
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && stats.ok) return null;

  const registeredSaved = stats.details?.filter((d) => d.userId && d.ok).length ?? 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-xs ${
        stats.ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      }`}
      role="status"
    >
      <p className="font-semibold">
        {stats.ok ? "Estatísticas gravadas" : "Problema ao gravar estatísticas"}
      </p>
      {stats.ok ? (
        <p className="mt-1">
          Sessões novas: {stats.recorded ?? 0}
          {stats.skipped ? ` — ${stats.reason ?? "já existiam"}` : ""}
          {!stats.skipped &&
            (registeredSaved > 0
              ? ` · ${registeredSaved} conta(s) registada(s) actualizada(s)`
              : stats.details && stats.details.length > 0
                ? " · só convidados (user_stats não incrementa)"
                : "")}
        </p>
      ) : (
        <p className="mt-1">{stats.error ?? "Erro desconhecido"}</p>
      )}
      {stats.details && stats.details.length > 0 && (
        <ul className="mt-2 space-y-1 font-mono">
          {stats.details.map((d) => (
            <li key={d.playerId}>
              {d.userId ? "registado" : "convidado"} · {d.ok ? "ok" : "falhou"}
              {d.skipped ? " (dup)" : ""}
              {d.error ? ` — ${d.error}` : ""}
            </li>
          ))}
        </ul>
      )}
      {!stats.ok && (
        <p className="mt-2 text-[11px] opacity-80">
          Corre a migração{" "}
          <code className="rounded bg-black/10 px-1">20250605280000_record_game_session.sql</code>{" "}
          no Supabase SQL Editor.
        </p>
      )}
    </div>
  );
}

export function Results({
  results,
  winnerPlayerId,
  localPlayerId,
  onPlayAgain,
  loading,
  statsInfo,
}: ResultsProps) {
  const winner = results.find((r) => r.playerId === winnerPlayerId);

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">{COPY.results}</h2>

      {statsInfo && <StatsDebugPanel stats={statsInfo} />}

      {!statsInfo && process.env.NODE_ENV === "development" && (
        <p className="text-xs text-muted-foreground">A gravar estatísticas…</p>
      )}

      {winner && (
        <p className="text-lg">
          {COPY.winner}: <span className="font-semibold text-primary">{winner.displayName}</span>
          {!winner.tooEarly && winner.reactionMs !== null && (
            <span className="text-muted-foreground"> ({winner.reactionMs}ms)</span>
          )}
          {winner.tooEarly && (
            <span className="text-destructive"> ({COPY.tooEarly})</span>
          )}
        </p>
      )}

      <ul className="space-y-3 text-sm">
        {results.map((result) => (
          <li
            key={result.playerId}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          >
            <span>
              {result.displayName}
              {result.playerId === localPlayerId ? ` (${COPY.you})` : ""}
            </span>
            <span className="font-mono tabular-nums">
              {result.tooEarly
                ? COPY.tooEarly
                : result.reactionMs !== null
                  ? `${result.reactionMs}ms · ${result.score} pts`
                  : "—"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" disabled={loading} onClick={onPlayAgain}>
          {COPY.playAgain}
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link href={`/games/${REACTION_DUEL_SLUG}`}>{COPY.backToCatalog}</Link>
        </Button>
      </div>
    </div>
  );
}
