import { Suspense } from "react";
import { UserBanManager } from "@/features/admin/components/user-ban-manager";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { listUsersForAdmin } from "@/services/admin.service";

export const metadata = buildPageMetadata({
  title: "Utilizadores — Administração",
  path: "/admin/users",
  noIndex: true,
});

export default async function AdminUsersPage() {
  const users = await listUsersForAdmin();

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">A carregar…</p>}>
      <UserBanManager initialUsers={users} />
    </Suspense>
  );
}
