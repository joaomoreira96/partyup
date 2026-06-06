"use client";

import Link from "next/link";
import { Play, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/locale-provider";

export function HeroSection() {
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
      <div className="relative z-10 max-w-2xl">
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
    </section>
  );
}
