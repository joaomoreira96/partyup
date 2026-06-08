"use client";

import Link from "next/link";
import { Crown, Medal, Play, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/locale-provider";
import { formatScoreForMetric } from "@/lib/games/types";
import type { LeaderboardEntry } from "@/types/platform";
import { cn } from "@/lib/utils";

const RANK_STYLES = [
  { icon: Crown, color: "text-accent", badge: "bg-accent/15 text-accent" },
  { icon: Trophy, color: "text-slate-300", badge: "bg-muted text-foreground" },
  { icon: Medal, color: "text-amber-600", badge: "bg-amber-600/15 text-amber-600" },
] as const;

function HeroRankingCard({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = useI18n();

  return (
    <aside
      aria-label={t("home.heroRankingTitle")}
      className="w-full rounded-[var(--radius-premium)] border border-border/60 bg-surface/80 p-4 backdrop-blur-sm lg:w-80"
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-4 text-accent" aria-hidden />
        <h2 className="text-sm font-semibold">{t("home.heroRankingTitle")}</h2>
      </div>
      <ol className="flex flex-col gap-2">
        {entries.map((entry, i) => {
          const style = RANK_STYLES[i] ?? RANK_STYLES[2];
          const Icon = style.icon;
          const name =
            entry.profile?.display_name ||
            entry.profile?.username ||
            t("common.player");
          return (
            <li key={entry.id}>
              <Link
                href={
                  entry.profile?.username
                    ? `/players/${entry.profile.username}`
                    : "/rankings"
                }
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                    style.badge
                  )}
                >
                  {i + 1}
                </span>
                <Icon className={cn("size-4 shrink-0", style.color)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {name}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-primary">
                  {formatScoreForMetric(entry.score, "score")}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Link
        href="/rankings"
        className="mt-3 block text-center text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {t("home.rankingsAction")}
      </Link>
    </aside>
  );
}

export function HeroSection({ ranking = [] }: { ranking?: LeaderboardEntry[] }) {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="hero-title"
      className="party-card-premium relative overflow-hidden border border-border/60 p-5 sm:p-7 lg:p-8"
    >
      <div
        className="party-gradient-hero pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
            <Sparkles className="size-3.5 text-accent" aria-hidden />
            {t("home.heroBadge")}
          </p>
          <h1
            id="hero-title"
            className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl lg:leading-tight"
          >
            {t("home.heroTitle")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="default" className="h-10 px-5" asChild>
              <Link href="/games/memoria-classica/play">
                <Play className="size-4" aria-hidden />
                {t("home.playNow")}
              </Link>
            </Button>
            <Button size="default" variant="secondary" className="h-10 px-5" asChild>
              <Link href="/games">{t("home.exploreGames")}</Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Users className="size-4 shrink-0 text-secondary" aria-hidden />
            {t("home.multiplayerHint")}
          </p>
        </div>

        {ranking.length > 0 ? <HeroRankingCard entries={ranking} /> : null}
      </div>
    </section>
  );
}
