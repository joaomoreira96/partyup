import { AdminGamesManager } from "@/features/admin/components/admin-games-manager";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  listCategoriesForAdmin,
  listGamesForAdmin,
} from "@/services/category-admin.service";

export const metadata = buildPageMetadata({
  title: "Jogos — Administração",
  path: "/admin/games",
  noIndex: true,
});

export default async function AdminGamesPage() {
  const [categories, games] = await Promise.all([
    listCategoriesForAdmin(),
    listGamesForAdmin(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-semibold">Jogos e categorias</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Gere o catálogo e as categorias dos jogos.
      </p>
      <div className="mt-6">
        <AdminGamesManager initialCategories={categories} initialGames={games} />
      </div>
    </div>
  );
}
