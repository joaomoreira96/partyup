import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { RoomLobby } from "@/features/rooms/components/room-lobby";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  extractGameSlugFromRoom,
  getRoomByCode,
  resolveOfflineRoomGame,
} from "@/services/room.service";
import { getGameBySlug } from "@/services/game.service";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ game?: string }>;
}

export const metadata = buildPageMetadata({
  title: "Sala multiplayer",
  path: "/rooms",
  noIndex: true,
});

export default async function RoomPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { game: gameSlugParam } = await searchParams;

  let gameSlug = gameSlugParam;
  const offline = !isSupabaseConfigured();

  if (!offline) {
    const room = await getRoomByCode(code);
    if (room) gameSlug = extractGameSlugFromRoom(room) ?? gameSlug;
  }

  if (!gameSlug) {
    return (
      <MainShell className="max-w-lg">
        <p className="text-muted-foreground">
          Sala {code}. Adiciona ?game=memoria-classica ao URL.
        </p>
      </MainShell>
    );
  }

  const game =
    (await getGameBySlug(gameSlug)) ?? resolveOfflineRoomGame(gameSlug);

  if (!game) notFound();

  return (
    <MainShell className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Sala multiplayer</h1>
      <RoomLobby code={code.toUpperCase()} game={game} offline={offline} />
    </MainShell>
  );
}
