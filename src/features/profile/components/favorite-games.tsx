"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { FavoriteGameToggle } from "@/features/games/components/favorite-game-toggle";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import { Button } from "@/components/ui/button";
import type { GameRecord } from "@/types/platform";

export function FavoriteGamesSection({ games }: { games: GameRecord[] }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState(games);

  function handleRemove(gameId: string) {
    setItems((current) => current.filter((game) => game.id !== gameId));
  }

  return (
    <section aria-labelledby="favorites-heading" className="mt-10">
      <h2
        id="favorites-heading"
        className="flex items-center gap-2 text-xl font-bold"
      >
        <Heart className="size-5 text-secondary" aria-hidden />
        {t("profile.favorites")}
      </h2>

      {items.length === 0 ? (
        <div className="party-card mt-4 p-6 text-center">
          <p className="text-muted-foreground">{t("profile.favoritesEmpty")}</p>
          <Button className="mt-4" variant="secondary" asChild>
            <Link href="/games">{t("profile.favoritesBrowse")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((game) => (
            <li key={game.id}>
              <article className="party-card relative flex flex-col overflow-hidden">
                <div className="absolute right-2 top-2 z-10">
                  <FavoriteGameToggle
                    gameId={game.id}
                    initialIsFavorite
                    variant="overlay"
                    onChange={(isFavorite) => {
                      if (!isFavorite) handleRemove(game.id);
                    }}
                  />
                </div>
                <Link
                  href={`/games/${game.slug}`}
                  className="flex flex-1 flex-col focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-video bg-surface">
                    <Image
                      src={game.thumbnail_url ?? "/games/placeholder-thumb.svg"}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 33vw"
                      loading="lazy"
                    />
                  </div>
                  <p className="truncate p-3 text-sm font-medium">
                    {getGameName(game, locale)}
                  </p>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
