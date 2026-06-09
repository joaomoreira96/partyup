import { redirect } from "next/navigation";
import { AdminOverview } from "@/features/admin/components/admin-overview";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getCurrentProfile, isAdmin } from "@/services/auth.service";
import { listUsersForAdmin } from "@/services/admin.service";
import { getPublishedGames } from "@/services/game.service";
import { countActiveRooms } from "@/services/room.service";

export const metadata = buildPageMetadata({
  title: "Administração",
  path: "/admin",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "developer" && !(await isAdmin())) {
    redirect("/admin/game-submissions");
  }

  const [games, roomsCount, users] = await Promise.all([
    getPublishedGames(),
    countActiveRooms(),
    listUsersForAdmin(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-semibold">Visão geral</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Resumo da atividade na plataforma.
      </p>
      <div className="mt-6">
        <AdminOverview
          gamesCount={games.length}
          roomsCount={roomsCount}
          usersCount={users.length}
        />
      </div>
    </div>
  );
}
