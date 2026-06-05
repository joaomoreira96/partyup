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

  return <UserBanManager initialUsers={users} />;
}
