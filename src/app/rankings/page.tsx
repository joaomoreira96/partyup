import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { MainShell } from "@/components/layout/main-shell";
import { LeaderboardPodium } from "@/components/design/leaderboard-podium";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateSlice, parsePageParam } from "@/lib/pagination";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getGameName } from "@/lib/game-localized";
import { getPublishedGames } from "@/services/game.service";
import { getMetricForGame, getPlatformPointsPodium } from "@/services/ranking.service";
import { RankingsSearch } from "@/features/rankings/components/rankings-search";

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("rankings.title"),
    path: "/rankings",
  });
}

export default async function RankingsPage({ searchParams }: PageProps) {
  const { t, locale } = await getServerI18n();
  const params = await searchParams;
  const [games, pointsPodium] = await Promise.all([
    getPublishedGames(),
    getPlatformPointsPodium(3),
  ]);
  const query = (params.q ?? "").trim().toLowerCase();
  const filteredGames = query
    ? games.filter((game) => {
        const haystack = [
          getGameName(game, locale),
          game.name,
          game.name_en,
          game.slug,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : games;
  const rankingsPage = parsePageParam(params.page);
  const rankingsPagination = paginateSlice(
    filteredGames,
    rankingsPage,
    DEFAULT_PAGE_SIZE
  );
  const pagedGames = rankingsPagination.items;

  return (
    <MainShell>
      <h1 className="text-3xl font-bold">{t("rankings.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("rankings.pageDescription")}</p>

      {pointsPodium.length > 0 && (
        <section className="mt-8" aria-labelledby="platform-podium-heading">
          <h2 id="platform-podium-heading" className="text-xl font-bold">
            {t("rankings.platformPodiumTitle")}
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {t("rankings.platformPodiumSubtitle")}
          </p>
          <LeaderboardPodium entries={pointsPodium} metric="score" />
        </section>
      )}

      <h2 className="mt-10 text-xl font-bold">{t("rankings.byGameTitle")}</h2>
      <Suspense fallback={null}>
        <RankingsSearch className="mt-4 max-w-md" />
      </Suspense>

      {pagedGames.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("rankings.noResults")}
        </p>
      ) : (
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {pagedGames.map((game) => (
          <li key={game.id}>
            <Link
              href={`/rankings/${game.slug}`}
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image
                  src={game.thumbnail_url ?? "/games/placeholder-thumb.svg"}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="64px"
                  loading="lazy"
                />
              </div>
              <div>
                <p className="font-semibold">{getGameName(game, locale)}</p>
                <p className="text-sm text-muted-foreground">
                  {getMetricForGame(game.module_id) === "time"
                    ? t("rankings.bestTime")
                    : t("rankings.bestScore")}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      )}
      <Suspense fallback={null}>
        <PaginationControls
          page={rankingsPagination.page}
          totalPages={rankingsPagination.totalPages}
          totalItems={rankingsPagination.totalItems}
          rangeStart={rankingsPagination.rangeStart}
          rangeEnd={rankingsPagination.rangeEnd}
          className="mt-8"
        />
      </Suspense>
    </MainShell>
  );
}
