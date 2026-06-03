export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "partyup-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "pt" || value === "en";
}
