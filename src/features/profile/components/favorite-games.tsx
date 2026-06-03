"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import type { GameRecord } from "@/types/platform";

export function FavoriteGamesSection({ games }: { games: GameRecord[] }) {
  const { t } = useI18n();

  if (!games.length) return null;

  return (
    <section aria-labelledby="favorites-heading" className="mt-10">
      <h2
        id="favorites-heading"
        className="flex items-center gap-2 text-xl font-bold"
      >
        <Heart className="size-5 text-secondary" aria-hidden />
        {t("profile.favorites")}
      </h2>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {games.map((game) => (
          <li key={game.id} className="snap-start shrink-0">
            <Link
              href={`/games/${game.slug}`}
              className="party-card flex w-36 flex-col overflow-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-video bg-surface">
                <Image
                  src={game.thumbnail_url ?? "/games/placeholder-thumb.svg"}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="144px"
                  loading="lazy"
                />
              </div>
              <p className="truncate p-2 text-sm font-medium">{game.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
