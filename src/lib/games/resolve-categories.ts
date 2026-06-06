import type { Category } from "@/types/platform";

/** Resolve categorias a partir de game_categories ou do campo legado games.category. */
export function resolveGameCategories(
  junctionCategories: Category[],
  legacyCategory: string | null | undefined,
  allCategories: Category[]
): Category[] {
  if (junctionCategories.length > 0) return junctionCategories;
  if (!legacyCategory?.trim()) return [];

  const key = legacyCategory.trim().toLowerCase();
  const match = allCategories.find(
    (c) =>
      c.slug.toLowerCase() === key ||
      c.name.toLowerCase() === key ||
      c.name_en.toLowerCase() === key
  );

  return match ? [match] : [];
}

export function gameMatchesCategorySlug(
  categories: Category[] | undefined,
  categorySlug: string
): boolean {
  return categories?.some((c) => c.slug === categorySlug) ?? false;
}

export function gameCategorySearchText(categories: Category[] | undefined): string {
  if (!categories?.length) return "";
  return categories
    .map((c) => `${c.name} ${c.name_en} ${c.slug}`)
    .join(" ");
}
