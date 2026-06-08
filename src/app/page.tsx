import { MainShell } from "@/components/layout/main-shell";
import { FeaturedGamesSection } from "@/features/home/components/featured-games";
import { HeroSection } from "@/features/home/components/hero-section";
import { RecentlyAddedGamesSection } from "@/features/home/components/recently-added-games";
import { NewsSection } from "@/features/home/components/news-section";
import { RankingsPreviewSection } from "@/features/home/components/rankings-preview";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getFeaturedGames, getRecentlyAddedGames } from "@/services/game.service";
import { getVisibleNews } from "@/services/news.service";
import {
  getGlobalRankingsPreview,
  getTopPlayersToday,
} from "@/services/ranking.service";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("meta.siteTitle"),
    path: "/",
  });
}

export default async function HomePage() {
  const { t, locale } = await getServerI18n();
  const [featured, recent, rankings, news, dailyTop] =
    await Promise.all([
      getFeaturedGames(),
      getRecentlyAddedGames(4),
      getGlobalRankingsPreview(),
      getVisibleNews(3),
      getTopPlayersToday(3),
    ]);

  return (
    <MainShell className="max-w-6xl">
      <HeroSection ranking={dailyTop} />
      <NewsSection news={news} title={t("home.newsTitle")} locale={locale} />
      <FeaturedGamesSection games={featured} />
      <RecentlyAddedGamesSection games={recent} />
      <RankingsPreviewSection previews={rankings} />
    </MainShell>
  );
}
