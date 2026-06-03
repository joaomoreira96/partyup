import { Suspense } from "react";
import { MainShell } from "@/components/layout/main-shell";
import { SectionHeading } from "@/components/design/section-heading";
import { EmptyState } from "@/components/shared/page-states";
import { CatalogFilters } from "@/features/games/components/catalog-filters";
import { GameCard } from "@/features/games/components/game-card";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getCategories, getPublishedGames } from "@/services/game.service";
import type { DeviceCompatibility } from "@/types/platform";

export const metadata = buildPageMetadata({
  title: "Catálogo de jogos",
  path: "/games",
});

interface PageProps {
  searchParams: Promise<{
    category?: string;
    q?: string;
    mobile?: string;
    desktop?: string;
    multiplayer?: string;
    device?: string;
  }>;
}

export default async function GamesCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const device =
    params.device && params.device !== "all"
      ? (params.device as DeviceCompatibility)
      : undefined;

  const [games, categories] = await Promise.all([
    getPublishedGames({
      category: params.category,
      device,
      query: params.q,
      mobile:
        params.mobile === "yes" || params.mobile === "no"
          ? params.mobile
          : undefined,
      desktop:
        params.desktop === "yes" || params.desktop === "no"
          ? params.desktop
          : undefined,
      multiplayer:
        params.multiplayer === "yes" || params.multiplayer === "no"
          ? params.multiplayer
          : undefined,
    }),
    getCategories(),
  ]);

  return (
    <MainShell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Jogos</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Explora o catálogo e filtra por categoria, dispositivo ou modo de jogo.
        </p>
      </header>

      <Suspense
        fallback={
          <div
            className="h-24 animate-pulse rounded-[var(--radius-md)] bg-surface motion-reduce:animate-none"
            role="status"
            aria-label="A carregar filtros"
          />
        }
      >
        <CatalogFilters categories={categories} />
      </Suspense>

      <section className="party-section" aria-labelledby="games-list-heading">
        <SectionHeading
          id="games-list-heading"
          title={`${games.length} jogos disponíveis`}
        />

        {games.length === 0 ? (
          <EmptyState
            title="Nenhum jogo encontrado"
            description="Experimenta outros filtros ou pesquisa."
            actionLabel="Limpar filtros"
            actionHref="/games"
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <li key={game.id}>
                <GameCard game={game} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainShell>
  );
}
