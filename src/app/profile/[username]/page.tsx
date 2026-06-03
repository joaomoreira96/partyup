import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getProfileByUsername } from "@/services/auth.service";
import { getUserStats } from "@/services/stats.service";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Perfil" };
  return buildPageMetadata({
    title: profile.display_name,
    description: `Perfil público de ${profile.display_name} no PartyUp.`,
    path: `/profile/${username}`,
  });
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) notFound();

  const stats = await getUserStats(profile.id);
  const playMinutes = Math.round(stats.total_play_time_seconds / 60);

  return (
    <MainShell className="max-w-lg">
      <h1 className="text-2xl font-bold">{profile.display_name}</h1>
      <p className="text-muted-foreground">@{profile.username}</p>

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Jogos</dt>
          <dd className="text-xl font-bold tabular-nums">{stats.total_games_played}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tempo</dt>
          <dd className="text-xl font-bold tabular-nums">{playMinutes} min</dd>
        </div>
      </dl>

    </MainShell>
  );
}
