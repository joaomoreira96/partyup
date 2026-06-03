import Link from "next/link";
import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { LeaderboardList } from "@/features/rankings/components/leaderboard-list";
import { buildPageMetadata } from "@/lib/seo/metadata";
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
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Ranking" };
  return buildPageMetadata({
    title: `Ranking — ${game.name}`,
    path: `/rankings/${slug}`,
  });
}

export default async function GameRankingPage({ params }: PageProps) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const metric = getMetricForGame(game.module_id);
  const entries = await getGameLeaderboard(game.id, metric);

  return (
    <MainShell className="max-w-2xl">
      <h1 className="text-2xl font-bold">Ranking — {game.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Rankings oficiais para utilizadores registados.
      </p>

      <div className="mt-8">
        <LeaderboardList entries={entries} metric={metric} gameSlug={game.slug} />
      </div>

      <Button variant="ghost" className="mt-8" asChild>
        <Link href={`/games/${game.slug}`}>← Voltar ao jogo</Link>
      </Button>
    </MainShell>
  );
}
