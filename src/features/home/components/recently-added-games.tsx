"use client";

import Link from "next/link";
import { GameCard } from "@/features/games/components/game-card";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { GameRecord } from "@/types/platform";

export function RecentlyAddedGamesSection({ games }: { games: GameRecord[] }) {
  const { t } = useI18n();

  if (!games.length) return null;

  return (
    <section className="mt-8 scroll-mt-24" aria-labelledby="recent-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="recent-heading" className="text-xl font-bold tracking-tight">
          {t("home.recentTitle")}
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/games">{t("home.recentAction")}</Link>
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}
