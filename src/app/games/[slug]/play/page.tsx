import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { LoadingState } from "@/components/shared/page-states";
import { buildGameMetadata } from "@/lib/seo/metadata";
import { getCurrentProfile, getSessionUser } from "@/services/auth.service";
import { getGameBySlug } from "@/services/game.service";
import { Button } from "@/components/ui/button";

const GamePlayer = dynamic(
  () =>
    import("@/features/games/components/game-player").then((m) => m.GamePlayer),
  { loading: () => <LoadingState label="A carregar jogo..." /> }
);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Jogar" };
  return buildGameMetadata({
    ...game,
    name: `Jogar — ${game.name}`,
  });
}

export default async function PlayGamePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { room } = await searchParams;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const user = await getSessionUser();
  const profile = await getCurrentProfile();

  return (
    <MainShell className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/games" className="hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          Jogos
        </Link>
        <span aria-hidden> / </span>
        <Link
          href={`/games/${game.slug}`}
          className="hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {game.name}
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Jogar</span>
      </nav>

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{game.name}</h1>
        <div className="text-sm text-muted-foreground">
          {user ? (
            <span>Jogador: {profile?.display_name ?? "Conta"}</span>
          ) : (
            <span>Modo convidado</span>
          )}
          {room && (
            <span className="ml-2 font-mono">Sala {room}</span>
          )}
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
        <Link href={`/games/${game.slug}`}>← Voltar</Link>
      </Button>
    </MainShell>
  );
}
