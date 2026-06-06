import type { Locale } from "@/i18n/config";
import type { Category } from "@/types/platform";

export function getCategoryName(category: Category, locale: Locale): string {
  if (locale === "en") {
    return category.name_en.trim() || category.name;
  }
  return category.name;
}
