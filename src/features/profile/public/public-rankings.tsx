import Link from "next/link";
import type { ActiveRanking } from "@/types/platform";

export function PublicRankings({ rankings }: { rankings: ActiveRanking[] }) {
  if (rankings.length === 0) return null;

  return (
    <section aria-labelledby="rankings-heading">
      <h2 id="rankings-heading" className="text-xl font-bold">
        Rankings ativos
      </h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {rankings.map((r) => (
          <li key={r.gameId}>
            <Link
              href={`/rankings/${r.slug}`}
              className="party-card inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-surface-hover"
            >
              <span className="font-medium">{r.gameName}</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary tabular-nums">
                #{r.rank}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
