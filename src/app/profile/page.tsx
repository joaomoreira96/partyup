import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Gamepad2, Star } from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { ProfileHeader } from "@/components/design/profile-header";
import { AchievementsGrid } from "@/features/profile/components/achievements-grid";
import { FavoriteGamesSection } from "@/features/profile/components/favorite-games";
import { ProfileSettings } from "@/features/profile/components/profile-settings";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";
import {
  getCurrentProfile,
  getSessionUser,
  isAdmin,
} from "@/services/auth.service";
import { getAchievementsForUser } from "@/services/achievements.service";
import { getUserFavoriteGames } from "@/services/favorites.service";
import { formatPlayTime } from "@/lib/profile/public-display";
import { getUserStats } from "@/services/stats.service";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("profile.title"),
    path: "/profile",
    noIndex: true,
  });
}

export default async function ProfilePage() {
  const { t, locale } = await getServerI18n();
  const numberLocale = locale === "pt" ? "pt-PT" : "en-US";
  const user = await getSessionUser();

  if (!user) {
    return (
      <MainShell className="max-w-lg text-center">
        <h1 className="text-2xl font-bold">{t("profile.privateTitle")}</h1>
        <p className="mt-4 text-muted-foreground">{t("profile.loginPrompt")}</p>
        <Button className="mt-6" asChild>
          <Link href="/login">{t("profile.loginCta")}</Link>
        </Button>
        <p className="mt-4 text-sm">
          {t("common.or")}{" "}
          <Link
            href="/games/memoria-classica/play"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("profile.guestContinue")}
          </Link>
        </p>
      </MainShell>
    );
  }

  if (await isAdmin()) redirect("/admin");

  const [profile, stats, achievements, favorites] = await Promise.all([
    getCurrentProfile(),
    getUserStats(user.id),
    getAchievementsForUser(user.id),
    getUserFavoriteGames(user.id),
  ]);

  if (!profile) redirect("/login");

  const statCards = [
    {
      label: t("profile.stats.games"),
      value: stats.total_games_played.toLocaleString(numberLocale),
      icon: Gamepad2,
    },
    {
      label: t("profile.stats.time"),
      value: formatPlayTime(stats.total_play_time_seconds, locale),
      icon: Clock,
    },
    {
      label: t("profile.stats.totalScore"),
      hint: t("profile.stats.totalScoreHint"),
      value: Math.round(stats.total_score).toLocaleString(numberLocale),
      icon: Star,
    },
  ];

  return (
    <MainShell className="max-w-3xl">
      <ProfileHeader
        profile={profile}
        subtitle={
          profile.username ? (
            <Link
              href={`/players/${profile.username}`}
              className="text-primary hover:underline"
            >
              {t("profile.publicLink")}
            </Link>
          ) : undefined
        }
      />

      <ProfileSettings profile={profile} />

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, hint }) => (
          <div
            key={label}
            className="party-card flex flex-col gap-2 p-4"
          >
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              <span title={hint}>{label}</span>
            </dt>
            <dd className="text-2xl font-bold tabular-nums">{value}</dd>
            {hint ? (
              <dd className="text-xs text-muted-foreground">{hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>

      <AchievementsGrid achievements={achievements} />
      <FavoriteGamesSection games={favorites} />
    </MainShell>
  );
}
