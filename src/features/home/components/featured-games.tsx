"use client";

import { GameCard } from "@/features/games/components/game-card";
import { SectionHeading } from "@/components/design/section-heading";
import { useI18n } from "@/features/i18n/locale-provider";
import type { GameRecord } from "@/types/platform";

export function FeaturedGamesSection({ games }: { games: GameRecord[] }) {
  const { t } = useI18n();

  if (!games.length) return null;

  return (
    <section className="party-section" aria-labelledby="featured-heading">
      <SectionHeading
        id="featured-heading"
        title={t("home.featuredTitle")}
        actionLabel={t("home.featuredAction")}
        actionHref="/games"
      />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}
