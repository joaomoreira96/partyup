import { MainShell } from "@/components/layout/main-shell";
import { CategoriesSection } from "@/features/home/components/categories-section";
import { FeaturedGamesSection } from "@/features/home/components/featured-games";
import { HeroSection } from "@/features/home/components/hero-section";
import { NewsSection } from "@/features/home/components/news-section";
import { RankingsPreviewSection } from "@/features/home/components/rankings-preview";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { getCategories, getFeaturedGames } from "@/services/game.service";
import { getVisibleNews } from "@/services/news.service";
import { getGlobalRankingsPreview } from "@/services/ranking.service";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("meta.siteTitle"),
    path: "/",
  });
}

export default async function HomePage() {
  const { t, locale } = await getServerI18n();
  const [featured, categories, rankings, news] = await Promise.all([
    getFeaturedGames(),
    getCategories(),
    getGlobalRankingsPreview(),
    getVisibleNews(3),
  ]);

  return (
    <MainShell className="max-w-6xl">
      <HeroSection />
      <NewsSection news={news} title={t("home.newsTitle")} locale={locale} />
      <FeaturedGamesSection games={featured} />
      <CategoriesSection categories={categories} />
      <RankingsPreviewSection previews={rankings} />
    </MainShell>
  );
}
