import Link from "next/link";
import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { PublicActivity } from "@/features/profile/public/public-activity";
import { PublicAchievements } from "@/features/profile/public/public-achievements";
import { PublicProfileHeader } from "@/features/profile/public/public-profile-header";
import { PublicRankings } from "@/features/profile/public/public-rankings";
import { PublicRecords } from "@/features/profile/public/public-records";
import { PublicStatsGrid } from "@/features/profile/public/public-stats-grid";
import { PublicTopGames } from "@/features/profile/public/public-top-games";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPublicPlayerProfile } from "@/services/public-profile.service";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  const data = await getPublicPlayerProfile(username);
  if (!data) return { title: "Jogador" };
  return buildPageMetadata({
    title: `${data.profile.display_name} (@${username})`,
    description: `Perfil público de ${data.profile.display_name} no PartyUp — estatísticas, recordes e conquistas.`,
    path: `/players/${username}`,
  });
}

export default async function PublicPlayerPage({ params }: PageProps) {
  const { username } = await params;
  const data = await getPublicPlayerProfile(username);

  if (!data) notFound();

  const { profile, isOwner } = data;
  const showCountry = profile.show_country !== false;

  return (
    <MainShell className="max-w-3xl space-y-10">
      {isOwner && profile.public_profile === false ? (
        <div
          className="rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          O teu perfil está <strong>privado</strong> — só tu vês esta página.{" "}
          <Link href="/profile" className="font-medium underline underline-offset-2">
            Alterar privacidade
          </Link>
        </div>
      ) : null}

      <PublicProfileHeader profile={profile} showCountry={showCountry} />

      <PublicStatsGrid
        stats={data.stats}
        achievementCount={data.achievementCount}
      />

      <PublicTopGames games={data.topGames} />

      <PublicRecords records={data.personalRecords} />

      <PublicRankings rankings={data.activeRankings} />

      <PublicAchievements achievements={data.achievements} />

      <PublicActivity items={data.recentActivity} />

      {isOwner ? (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" asChild>
            <Link href="/profile">Editar o meu perfil</Link>
          </Button>
        </div>
      ) : null}
    </MainShell>
  );
}
