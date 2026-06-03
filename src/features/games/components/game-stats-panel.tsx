"use client";

import { useI18n } from "@/features/i18n/locale-provider";
import type { GameStats } from "@/types/platform";

export function GameStatsPanel({ stats }: { stats: GameStats | null }) {
  const { t, locale } = useI18n();

  if (!stats) return null;

  const avgSeconds =
    stats.total_sessions > 0
      ? Math.round(stats.total_play_time_seconds / stats.total_sessions)
      : 0;

  const numberLocale = locale === "pt" ? "pt-PT" : "en-US";

  return (
    <section
      aria-labelledby="game-stats-heading"
      className="party-card p-4"
    >
      <h2 id="game-stats-heading" className="text-sm font-semibold">
        {t("games.detail.stats")}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("games.stats.sessions")}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">
            {stats.total_sessions}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("games.stats.record")}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-accent">
            {Math.round(stats.highest_score).toLocaleString(numberLocale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("games.stats.avgTime")}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{avgSeconds}s</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("games.stats.players")}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">
            {stats.total_players}
          </dd>
        </div>
      </dl>
    </section>
  );
}
