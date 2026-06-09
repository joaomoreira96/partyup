import Link from "next/link";
import { redirect } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import {
  getCurrentProfile,
  isAdmin,
  isDeveloperOrAdmin,
} from "@/services/auth.service";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <MainShell className="max-w-lg text-center">
        <p>Acesso reservado a administradores e developers.</p>
        <Button className="mt-4" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </MainShell>
    );
  }

  if (!(await isDeveloperOrAdmin())) redirect("/profile");

  const admin = await isAdmin();

  return (
    <MainShell className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Painel de administração</h1>
        <p className="mt-2 text-muted-foreground">
          {admin
            ? "Gerir utilizadores, jogos e conteúdo da plataforma."
            : "Submeter e acompanhar pacotes de jogos."}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <AdminSidebar isAdmin={admin} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </MainShell>
  );
}
