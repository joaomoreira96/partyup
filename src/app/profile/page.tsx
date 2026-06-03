import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Gamepad2, Target } from "lucide-react";
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
import { getFeaturedGames } from "@/services/game.service";
import { getUserStats } from "@/services/stats.service";
import { Button } from "@/components/ui/button";

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
    getFeaturedGames(),
  ]);

  if (!profile) redirect("/login");

  const playMinutes = Math.round(stats.total_play_time_seconds / 60);

  const statCards = [
    {
      label: t("profile.stats.games"),
      value: stats.total_games_played,
      icon: Gamepad2,
    },
    {
      label: t("profile.stats.time"),
      value: t("profile.stats.minutes", { min: playMinutes }),
      icon: Clock,
    },
    {
      label: t("profile.stats.record"),
      value: Math.round(stats.highest_score).toLocaleString(numberLocale),
      icon: Target,
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
        {statCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="party-card flex flex-col gap-2 p-4"
          >
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              {label}
            </dt>
            <dd className="text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <AchievementsGrid achievements={achievements} />
      <FavoriteGamesSection games={favorites.slice(0, 4)} />
    </MainShell>
  );
}
