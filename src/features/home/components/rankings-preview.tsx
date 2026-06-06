"use client";

import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { SectionHeading } from "@/components/design/section-heading";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import { formatScoreForMetric } from "@/lib/games/types";
import type { RankingPreview } from "@/services/ranking.service";

export function RankingsPreviewSection({
  previews,
}: {
  previews: RankingPreview[];
}) {
  const { t, locale } = useI18n();

  return (
    <section className="party-section" aria-labelledby="rankings-preview-heading">
      <SectionHeading
        id="rankings-preview-heading"
        title={t("home.rankingsTitle")}
        actionLabel={t("home.rankingsAction")}
        actionHref="/rankings"
      />
      {previews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("home.rankingsEmpty")}</p>
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
                  <p className="font-semibold truncate">{getGameName(game, locale)}</p>
                  {topEntry ? (
                    <p className="text-sm text-muted-foreground">
                      {t("home.rankingsLeader", {
                        name: topEntry.profile?.display_name ?? t("common.player"),
                      })}{" "}
                      <span className="font-mono text-primary">
                        {formatScoreForMetric(topEntry.score, metric)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("home.rankingsNoLeader")}
                    </p>
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
