import type { Locale } from "@/i18n/config";

export type LocalizedGameName = {
  name: string;
  name_en?: string | null;
};

export function getGameName(game: LocalizedGameName, locale: Locale): string {
  if (locale === "en") {
    return (game.name_en ?? "").trim() || game.name;
  }
  return game.name;
}
