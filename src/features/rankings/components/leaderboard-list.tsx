import Link from "next/link";
import { LeaderboardPodium } from "@/components/design/leaderboard-podium";
import { EmptyState } from "@/components/shared/page-states";
import { formatScoreForMetric } from "@/lib/games/types";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types/platform";
export function LeaderboardList({
  entries,
  metric,
  gameSlug,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
  gameSlug?: string;
}) {
  if (!entries.length) {
    return (
      <EmptyState
        title="Sem pontuações ainda"
        description="Sê o primeiro no ranking — cria conta e joga!"
        actionLabel="Criar conta"
        actionHref="/register"
      />
    );
  }

  const rest = entries.slice(3);

  return (
    <div>
      {entries.length >= 1 && (
        <LeaderboardPodium entries={entries.slice(0, 3)} metric={metric} />
      )}

      {rest.length > 0 && (
        <ol className="space-y-2" aria-label="Restante classificação">
          {rest.map((entry, i) => (
            <li
              key={entry.id}
              className="party-card flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">
                <span className="mr-3 tabular-nums text-muted-foreground">
                  #{i + 4}
                </span>
                {entry.profile?.username ? (
                  <Link
                    href={`/profile/${entry.profile.username}`}
                    className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {entry.profile.display_name ?? entry.profile.username}
                  </Link>
                ) : (
                  (entry.profile?.display_name ?? "Jogador")
                )}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                {formatScoreForMetric(entry.score, metric)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {entries.length <= 3 && entries.length > 0 && (
        <ol className="sr-only" aria-label="Classificação completa">
          {entries.map((e, i) => (
            <li key={e.id}>
              {i + 1}. {e.profile?.display_name}
            </li>
          ))}
        </ol>
      )}

      {gameSlug && (
        <p className="mt-6 text-center text-sm">
          <Link
            href={`/games/${gameSlug}/play`}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Jogar e subir no ranking
          </Link>
        </p>
      )}
    </div>
  );
}
