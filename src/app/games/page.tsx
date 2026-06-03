import { Suspense } from "react";
import { MainShell } from "@/components/layout/main-shell";
import { SectionHeading } from "@/components/design/section-heading";
import { EmptyState } from "@/components/shared/page-states";
import { CatalogFilters } from "@/features/games/components/catalog-filters";
import { GameCard } from "@/features/games/components/game-card";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getCategories, getPublishedGames } from "@/services/game.service";
import type { DeviceCompatibility } from "@/types/platform";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("games.title"),
    path: "/games",
  });
}

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
  const { t } = await getServerI18n();
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
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("games.catalogHeading")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("games.catalogDescription")}
        </p>
      </header>

      <Suspense
        fallback={
          <div
            className="h-24 animate-pulse rounded-[var(--radius-md)] bg-surface motion-reduce:animate-none"
            role="status"
            aria-label={t("games.loadingFilters")}
          />
        }
      >
        <CatalogFilters categories={categories} />
      </Suspense>

      <section className="party-section" aria-labelledby="games-list-heading">
        <SectionHeading
          id="games-list-heading"
          title={t("games.countAvailable", { count: games.length })}
        />

        {games.length === 0 ? (
          <EmptyState
            title={t("games.emptyTitle")}
            description={t("games.emptyDescription")}
            actionLabel={t("games.clearFilters")}
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
