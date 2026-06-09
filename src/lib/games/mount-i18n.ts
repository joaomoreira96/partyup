import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { translate } from "@/i18n/translate";

/** Traduções para módulos montados fora de React (DOM imperativo). */
export function createGameMountI18n(locale: Locale) {
  const dict = getDictionary(locale);
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(dict, key, params),
  };
}

export type GameMountI18n = ReturnType<typeof createGameMountI18n>;
