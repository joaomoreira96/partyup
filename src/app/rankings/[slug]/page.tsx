import Link from "next/link";
import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { LeaderboardList } from "@/features/rankings/components/leaderboard-list";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getGameName } from "@/lib/game-localized";
import { getGameBySlug } from "@/services/game.service";
import {
  getGameLeaderboard,
  getMetricForGame,
} from "@/services/ranking.service";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { t, locale } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) return { title: t("rankings.metadataTitle") };
  return buildPageMetadata({
    title: t("rankings.pageTitle", { name: getGameName(game, locale) }),
    path: `/rankings/${slug}`,
  });
}

export default async function GameRankingPage({ params }: PageProps) {
  const { slug } = await params;
  const { t, locale } = await getServerI18n();
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const metric = getMetricForGame(game.module_id);
  const entries = await getGameLeaderboard(game.id, metric);

  return (
    <MainShell className="max-w-2xl">
      <h1 className="text-2xl font-bold">
        {t("rankings.pageTitle", { name: getGameName(game, locale) })}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("rankings.officialHint")}</p>

      <div className="mt-8">
        <LeaderboardList entries={entries} metric={metric} gameSlug={game.slug} />
      </div>

      <Button variant="ghost" className="mt-8" asChild>
        <Link href={`/games/${game.slug}`}>{t("rankings.backToGame")}</Link>
      </Button>
    </MainShell>
  );
}
