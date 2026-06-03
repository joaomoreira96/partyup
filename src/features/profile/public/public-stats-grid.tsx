"use client";

import { Clock, Gamepad2, Star, Trophy } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { formatPlayTimeHours } from "@/lib/profile/public-display";
import type { UserStats } from "@/types/platform";

export function PublicStatsGrid({
  stats,
  achievementCount,
}: {
  stats: UserStats;
  achievementCount: number;
}) {
  const { t, locale } = useI18n();
  const numberLocale = locale === "pt" ? "pt-PT" : "en-US";

  const items = [
    {
      label: t("publicProfile.stats.gamesPlayed"),
      value: stats.total_games_played.toLocaleString(numberLocale),
      icon: Gamepad2,
    },
    {
      label: t("publicProfile.stats.totalTime"),
      value: formatPlayTimeHours(stats.total_play_time_seconds, locale),
      icon: Clock,
    },
    {
      label: t("publicProfile.stats.totalScore"),
      value: Math.round(stats.total_score).toLocaleString(numberLocale),
      icon: Star,
    },
    {
      label: t("publicProfile.stats.achievements"),
      value: achievementCount.toLocaleString(numberLocale),
      icon: Trophy,
    },
  ];

  return (
    <section aria-labelledby="public-stats-heading">
      <h2 id="public-stats-heading" className="sr-only">
        {t("publicProfile.statsHeading")}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="party-card flex flex-col gap-2 p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </dt>
            <dd className="text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
