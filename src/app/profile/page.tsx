import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Gamepad2, Target } from "lucide-react";
import { MainShell } from "@/components/layout/main-shell";
import { ProfileHeader } from "@/components/design/profile-header";
import { AchievementsGrid } from "@/features/profile/components/achievements-grid";
import { FavoriteGamesSection } from "@/features/profile/components/favorite-games";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  getCurrentProfile,
  getSessionUser,
  isAdmin,
} from "@/services/auth.service";
import { getAchievementsForUser } from "@/services/achievements.service";
import { getFeaturedGames } from "@/services/game.service";
import { getUserStats } from "@/services/stats.service";
import { Button } from "@/components/ui/button";

export const metadata = buildPageMetadata({
  title: "Perfil",
  path: "/profile",
  noIndex: true,
});

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <MainShell className="max-w-lg text-center">
        <h1 className="text-2xl font-bold">O teu perfil</h1>
        <p className="mt-4 text-muted-foreground">
          Inicia sessão para ver estatísticas e conquistas.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
        <p className="mt-4 text-sm">
          Ou{" "}
          <Link
            href="/games/memoria-classica/play"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            continua como convidado
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
      label: "Jogos",
      value: stats.total_games_played,
      icon: Gamepad2,
    },
    {
      label: "Tempo",
      value: `${playMinutes} min`,
      icon: Clock,
    },
    {
      label: "Recorde",
      value: Math.round(stats.highest_score).toLocaleString("pt-PT"),
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
              href={`/profile/${profile.username}`}
              className="text-primary hover:underline"
            >
              Ver perfil público →
            </Link>
          ) : undefined
        }
      />

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
