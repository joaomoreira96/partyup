import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { GamePlayerLoading } from "@/features/games/components/game-player-loading";
import { buildGameMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getGameName } from "@/lib/game-localized";
import { getCurrentProfile, getSessionUser } from "@/services/auth.service";
import { getGameBySlug } from "@/services/game.service";
import { Button } from "@/components/ui/button";

const GamePlayer = dynamic(
  () =>
    import("@/features/games/components/game-player").then((m) => m.GamePlayer),
  { loading: () => <GamePlayerLoading /> }
);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { t, locale } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) return { title: t("games.metadataPlay") };
  return buildGameMetadata(
    {
      ...game,
      name: t("games.playTitle", { name: getGameName(game, locale) }),
    },
    locale
  );
}

export default async function PlayGamePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { room } = await searchParams;
  const { t, locale } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) notFound();
  const gameName = getGameName(game, locale);

  const user = await getSessionUser();
  const profile = await getCurrentProfile();

  return (
    <MainShell className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link
          href="/games"
          className="hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {t("games.catalogHeading")}
        </Link>
        <span aria-hidden> / </span>
        <Link
          href={`/games/${game.slug}`}
          className="hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {gameName}
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{t("games.playNav")}</span>
      </nav>

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{gameName}</h1>
        <div className="text-sm text-muted-foreground">
          {user ? (
            <span>
              {t("games.playerLabel", {
                name: profile?.display_name ?? t("common.account"),
              })}
            </span>
          ) : (
            <span>{t("games.guestMode")}</span>
          )}
          {room && <span className="ml-2 font-mono">{t("games.roomLabel", { code: room })}</span>}
        </div>
      </header>

      <GamePlayer
        game={game}
        userId={user?.id}
        userDisplayName={profile?.display_name}
        isGuest={!user}
        roomCode={room}
      />

      <Button variant="ghost" className="mt-6" asChild>
        <Link href={`/games/${game.slug}`}>{t("games.backToGame")}</Link>
      </Button>
    </MainShell>
  );
}
