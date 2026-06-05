import Link from "next/link";
import { redirect } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { UserBanManager } from "@/features/admin/components/user-ban-manager";
import { getCurrentProfile, isAdmin } from "@/services/auth.service";
import { listUsersForAdmin } from "@/services/admin.service";
import { getPublishedGames } from "@/services/game.service";
import { countActiveRooms } from "@/services/room.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = buildPageMetadata({
  title: "Administração",
  path: "/admin",
  noIndex: true,
});

export default async function AdminPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <MainShell className="max-w-lg text-center">
        <p>Acesso reservado a administradores.</p>
        <Button className="mt-4" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </MainShell>
    );
  }

  if (!(await isAdmin())) redirect("/profile");

  const [games, roomsCount, users] = await Promise.all([
    getPublishedGames(),
    countActiveRooms(),
    listUsersForAdmin(),
  ]);

  return (
    <MainShell className="max-w-4xl">
      <h1 className="text-2xl font-bold">Painel de administração</h1>
      <p className="mt-2 text-muted-foreground">
        Gerir jogos, salas e conteúdo da plataforma.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-6">
          <p className="text-3xl font-bold tabular-nums">{games.length}</p>
          <p className="text-sm text-muted-foreground">Jogos publicados</p>
        </div>
        <div className="rounded-xl border p-6">
          <p className="text-3xl font-bold tabular-nums">{roomsCount}</p>
          <p className="text-sm text-muted-foreground">Salas (DB)</p>
        </div>
      </section>

      <UserBanManager initialUsers={users} />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Jogos</h2>
        <ul className="mt-4 space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
            >
              <span className="font-medium">{g.name}</span>
              <div className="flex gap-2">
                <Badge>{g.status}</Badge>
                <Badge variant="outline">{g.module_id}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </MainShell>
  );
}
