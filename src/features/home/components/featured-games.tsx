import { GameCard } from "@/features/games/components/game-card";
import { SectionHeading } from "@/components/design/section-heading";
import type { GameRecord } from "@/types/platform";

export function FeaturedGamesSection({ games }: { games: GameRecord[] }) {
  if (!games.length) return null;

  return (
    <section className="party-section" aria-labelledby="featured-heading">
      <SectionHeading
        id="featured-heading"
        title="Jogos em destaque"
        actionLabel="Ver todos"
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
