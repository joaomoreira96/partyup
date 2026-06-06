"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { getCategoryName } from "@/lib/category-localized";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category } from "@/types/platform";

const selectClass =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CatalogFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/games?${next.toString()}`, { scroll: false });
  }

  return (
    <section
      aria-label={t("games.filtersAria")}
      className="party-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <div className="space-y-2 sm:col-span-2 xl:col-span-2">
        <Label htmlFor="search-games">{t("games.filters.search")}</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="search-games"
            type="search"
            placeholder={t("games.filters.searchPlaceholder")}
            className="pl-9"
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => update("q", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-category">{t("games.filters.category")}</Label>
        <select
          id="filter-category"
          className={selectClass}
          defaultValue={params.get("category") ?? "all"}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="all">{t("games.filters.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {getCategoryName(c, locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-mobile">{t("games.filters.mobile")}</Label>
        <select
          id="filter-mobile"
          className={selectClass}
          defaultValue={params.get("mobile") ?? "all"}
          onChange={(e) => update("mobile", e.target.value)}
        >
          <option value="all">{t("games.filters.all")}</option>
          <option value="yes">{t("games.filters.supported")}</option>
          <option value="no">{t("games.filters.notSupported")}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-desktop">{t("games.filters.desktop")}</Label>
        <select
          id="filter-desktop"
          className={selectClass}
          defaultValue={params.get("desktop") ?? "all"}
          onChange={(e) => update("desktop", e.target.value)}
        >
          <option value="all">{t("games.filters.all")}</option>
          <option value="yes">{t("games.filters.supported")}</option>
          <option value="no">{t("games.filters.notSupported")}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-mode">{t("games.filters.mode")}</Label>
        <select
          id="filter-mode"
          className={selectClass}
          defaultValue={params.get("multiplayer") ?? "all"}
          onChange={(e) => update("multiplayer", e.target.value)}
        >
          <option value="all">{t("games.filters.all")}</option>
          <option value="yes">{t("games.filters.multiplayer")}</option>
          <option value="no">{t("games.filters.singlePlayerOption")}</option>
        </select>
      </div>
    </section>
  );
}
