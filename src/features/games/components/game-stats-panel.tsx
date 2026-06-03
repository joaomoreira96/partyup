import type { GameStats } from "@/types/platform";

export function GameStatsPanel({ stats }: { stats: GameStats | null }) {
  if (!stats) return null;

  const avgSeconds =
    stats.total_sessions > 0
      ? Math.round(stats.total_play_time_seconds / stats.total_sessions)
      : 0;

  return (
    <section
      aria-labelledby="game-stats-heading"
      className="party-card p-4"
    >
      <h2 id="game-stats-heading" className="text-sm font-semibold">
        Estatísticas
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Sessões</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">
            {stats.total_sessions}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recorde</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-accent">
            {Math.round(stats.highest_score).toLocaleString("pt-PT")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tempo médio</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{avgSeconds}s</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jogadores</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">
            {stats.total_players}
          </dd>
        </div>
      </dl>
    </section>
  );
}
