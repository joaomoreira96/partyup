import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { SectionHeading } from "@/components/design/section-heading";
import { formatScoreForMetric } from "@/lib/games/types";
import type { RankingPreview } from "@/services/ranking.service";

export function RankingsPreviewSection({
  previews,
}: {
  previews: RankingPreview[];
}) {
  return (
    <section className="party-section" aria-labelledby="rankings-preview-heading">
      <SectionHeading
        id="rankings-preview-heading"
        title="Rankings"
        actionLabel="Ver rankings"
        actionHref="/rankings"
      />
      {previews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem pontuações — sê o primeiro!
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {previews.map(({ game, topEntry, metric }) => (
            <li key={game.slug}>
              <Link
                href={`/rankings/${game.slug}`}
                className="party-card flex items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface">
                  <Image
                    src={game.thumbnail_url ?? "/games/placeholder-thumb.svg"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{game.name}</p>
                  {topEntry ? (
                    <p className="text-sm text-muted-foreground">
                      Líder: {topEntry.profile?.display_name ?? "Jogador"} —{" "}
                      <span className="font-mono text-primary">
                        {formatScoreForMetric(topEntry.score, metric)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem líder</p>
                  )}
                </div>
                <Trophy className="size-5 shrink-0 text-accent" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
