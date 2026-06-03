import Image from "next/image";
import Link from "next/link";
import { Star, Users } from "lucide-react";
import { CompatibilityBadges } from "@/features/games/components/compatibility-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameRecord } from "@/types/platform";

export function GameCard({ game }: { game: GameRecord }) {
  return (
    <article
      className={cn(
        "party-card flex h-full flex-col overflow-hidden",
        game.featured && "party-card-featured"
      )}
    >
      <Link
        href={`/games/${game.slug}`}
        className="relative block aspect-[16/10] overflow-hidden bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Image
          src={game.thumbnail_url ?? "/games/placeholder-thumb.svg"}
          alt=""
          fill
          className="object-cover transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.02] motion-reduce:hover:scale-100"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
        />
        {game.featured && (
          <Badge
            className="absolute left-3 top-3 gap-1 border-0 bg-accent text-accent-foreground"
          >
            <Star className="size-3" aria-hidden />
            Destaque
          </Badge>
        )}
        <span className="sr-only">{game.name}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {game.categories?.map((cat) => (
            <Badge
              key={cat.slug}
              variant="secondary"
              className="bg-surface-hover text-xs"
            >
              {cat.name}
            </Badge>
          ))}
        </div>
        <h3 className="text-lg font-semibold leading-tight">
          <Link
            href={`/games/${game.slug}`}
            className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {game.name}
          </Link>
        </h3>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {game.description}
        </p>
        <CompatibilityBadges game={game} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        {game.supports_multiplayer ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            Multiplayer
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Single player</span>
        )}
        <Button size="sm" asChild>
          <Link href={`/games/${game.slug}/play`}>Jogar</Link>
        </Button>
      </div>
    </article>
  );
}
