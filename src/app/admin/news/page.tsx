import { AdminNewsManager } from "@/features/admin/components/admin-news-manager";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { listNewsForAdmin } from "@/services/news.service";

export const metadata = buildPageMetadata({
  title: "News — Administração",
  path: "/admin/news",
  noIndex: true,
});

export default async function AdminNewsPage() {
  const news = await listNewsForAdmin();

  return <AdminNewsManager initialNews={news} />;
}
