import Image from "next/image";
import Link from "next/link";
import {
  formatPlayTimeHours,
  formatRecordScore,
} from "@/services/public-profile.service";
import type { TopGameStat } from "@/types/platform";

export function PublicTopGames({ games }: { games: TopGameStat[] }) {
  if (games.length === 0) {
    return (
      <section className="party-card p-6 text-center text-sm text-muted-foreground">
        Ainda sem jogos registados.
      </section>
    );
  }

  return (
    <section aria-labelledby="top-games-heading">
      <h2 id="top-games-heading" className="text-xl font-bold">
        Top jogos
      </h2>
      <ul className="mt-4 space-y-3">
        {games.map((game) => (
          <li key={game.gameId}>
            <Link
              href={`/games/${game.slug}`}
              className="party-card flex gap-4 p-4 transition-colors hover:bg-surface-hover"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-muted">
                {game.thumbnailUrl ? (
                  <Image
                    src={game.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {game.name[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{game.name}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt>Partidas</dt>
                    <dd className="font-semibold text-foreground tabular-nums">
                      {game.sessions}
                    </dd>
                  </div>
                  <div>
                    <dt>Tempo</dt>
                    <dd className="font-semibold text-foreground">
                      {formatPlayTimeHours(game.playTimeSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt>Melhor</dt>
                    <dd className="font-semibold text-foreground tabular-nums">
                      {game.bestScore > 0
                        ? formatRecordScore(game.bestScore, game.metric)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
