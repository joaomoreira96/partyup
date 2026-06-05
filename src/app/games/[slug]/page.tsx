import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { CompatibilityBadges } from "@/features/games/components/compatibility-badges";
import { GameStatsPanel } from "@/features/games/components/game-stats-panel";
import { CreateRoomButton } from "@/features/rooms/components/create-room-button";
import { JoinRoomForm } from "@/features/rooms/components/join-room-form";
import { buildGameMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getSessionUser } from "@/services/auth.service";
import { isGameFavorite } from "@/services/favorites.service";
import { FavoriteGameToggle } from "@/features/games/components/favorite-game-toggle";
import { getGameBySlug, getGameStats } from "@/services/game.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { t } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) return { title: t("games.metadataGame") };
  return buildGameMetadata(game);
}

export default async function GameDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { t } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const user = await getSessionUser();
  const [stats, isFavorite] = await Promise.all([
    getGameStats(game.id),
    user ? isGameFavorite(user.id, game.id) : Promise.resolve(false),
  ]);

  return (
    <MainShell>
      <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-2xl bg-muted">
        <Image
          src={game.banner_url ?? "/games/placeholder-banner.svg"}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <h1 className="text-2xl font-bold sm:text-4xl">{game.name}</h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <p className="text-lg text-muted-foreground">{game.description}</p>
          <div className="flex flex-wrap gap-2">
            {game.categories?.map((cat) => (
              <Badge key={cat.slug} variant="secondary">
                {cat.name}
              </Badge>
            ))}
          </div>
          <CompatibilityBadges game={game} />
          <GameStatsPanel stats={stats} />
        </div>

        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          {user ? (
            <FavoriteGameToggle
              gameId={game.id}
              initialIsFavorite={isFavorite}
            />
          ) : null}
          <Button size="lg" asChild>
            <Link href={`/games/${game.slug}/play`}>{t("common.play")}</Link>
          </Button>
          <CreateRoomButton
            gameSlug={game.slug}
            supportsMultiplayer={game.supports_multiplayer}
          />
          {game.supports_multiplayer && <JoinRoomForm gameSlug={game.slug} />}
          <Button variant="outline" asChild>
            <Link href={`/rankings/${game.slug}`}>
              <Trophy className="size-4" aria-hidden />
              {t("games.detail.leaderboard")}
            </Link>
          </Button>
        </aside>
      </div>
    </MainShell>
  );
}
