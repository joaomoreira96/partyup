import { Suspense } from "react";
import { redirect } from "next/navigation";
import { GameSubmissionsManager } from "@/features/admin/components/game-submissions-manager";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { isAdmin, isDeveloperOrAdmin, getCurrentProfile } from "@/services/auth.service";
import { listGameSubmissions } from "@/services/game-submissions.service";

export const metadata = buildPageMetadata({
  title: "Submissões de jogos — Administração",
  path: "/admin/game-submissions",
  noIndex: true,
});

export default async function AdminGameSubmissionsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !(await isDeveloperOrAdmin())) {
    redirect("/profile");
  }

  const submissions = await listGameSubmissions();
  const admin = await isAdmin();

  return (
    <div>
      <h2 className="text-lg font-semibold">Game Submissions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pipeline V2 — upload de pacotes ZIP, revisão e publicação no catálogo.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">A carregar…</p>
          }
        >
          <GameSubmissionsManager
            initialSubmissions={submissions}
            isAdmin={admin}
          />
        </Suspense>
      </div>
    </div>
  );
}
