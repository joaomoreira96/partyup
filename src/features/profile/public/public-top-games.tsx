"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/features/i18n/locale-provider";
import { AchievementsPagination } from "@/features/profile/components/achievements-pagination";
import { getGameName } from "@/lib/game-localized";
import { formatRecordScore } from "@/lib/profile/public-display";
import type { PublicFavoriteGame, TopGameStat } from "@/types/platform";

const FAVORITES_PAGE_SIZE = 6;

function FavoriteGamesSection({
  favorites,
}: {
  favorites: PublicFavoriteGame[];
}) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(
    1,
    Math.ceil(favorites.length / FAVORITES_PAGE_SIZE)
  );
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () =>
      favorites.slice(
        safePage * FAVORITES_PAGE_SIZE,
        safePage * FAVORITES_PAGE_SIZE + FAVORITES_PAGE_SIZE
      ),
    [favorites, safePage]
  );

  return (
    <section aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" className="text-xl font-bold">
        {t("publicProfile.favoriteGames")}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((game) => (
          <li key={game.gameId}>
            <Link
              href={`/games/${game.slug}`}
              className="party-card flex items-center gap-4 p-4 transition-colors hover:bg-surface-hover"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-muted">
                {game.thumbnailUrl ? (
                  <Image
                    src={game.thumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {getGameName(game, locale)[0]}
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 font-semibold">
                {getGameName(game, locale)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <AchievementsPagination
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </section>
  );
}

export function PublicTopGames({
  games,
  favorites = [],
}: {
  games: TopGameStat[];
  favorites?: PublicFavoriteGame[];
}) {
  const { t, locale } = useI18n();

  if (games.length === 0) {
    if (favorites.length === 0) {
      return (
        <section className="party-card p-6 text-center text-sm text-muted-foreground">
          {t("publicProfile.noGames")}
        </section>
      );
    }

    return <FavoriteGamesSection favorites={favorites} />;
  }

  return (
    <section aria-labelledby="games-heading">
      <h2 id="games-heading" className="text-xl font-bold">
        {t("publicProfile.games")}
      </h2>
      <ul className="mt-4 space-y-3">
        {games.map((game) => (
          <li key={game.gameId}>
            <Link
              href={`/games/${game.slug}`}
              className="party-card flex gap-4 p-4 transition-colors hover:bg-surface-hover"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-muted">
                {game.thumbnailUrl ? (
                  <Image
                    src={game.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {getGameName(game, locale)[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{getGameName(game, locale)}</p>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("publicProfile.bestScore")}
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {game.bestScore > 0
                        ? formatRecordScore(game.bestScore, game.metric)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("publicProfile.sessions")}
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {game.sessions}
                    </dd>
                  </div>
                </dl>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
