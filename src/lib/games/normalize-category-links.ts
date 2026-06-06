import type { Category } from "@/types/platform";

export type GameCategoryLink = {
  category_id?: string;
  categories: Category | null;
};

function normalizeEmbeddedCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? (first as Category) : null;
  }
  return raw as Category;
}

/** PostgREST devolve objeto quando há 1 linha e array quando há várias. */
export function normalizeGameCategoryLinks(raw: unknown): GameCategoryLink[] {
  const rows: unknown[] = !raw
    ? []
    : Array.isArray(raw)
      ? raw
      : typeof raw === "object"
        ? [raw]
        : [];

  return rows.map((row) => {
    const link = row as { category_id?: string; categories?: unknown };
    const category = normalizeEmbeddedCategory(link.categories);
    return {
      category_id:
        typeof link.category_id === "string" ? link.category_id : category?.id,
      categories: category,
    };
  });
}

export function extractCategoriesFromLinks(links: GameCategoryLink[]): Category[] {
  return links
    .map((link) => link.categories)
    .filter((category): category is Category => category != null);
}

export function extractCategoryIdsFromLinks(links: GameCategoryLink[]): string[] {
  const fromLinks = links
    .map((link) => link.category_id ?? link.categories?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(fromLinks)];
}
