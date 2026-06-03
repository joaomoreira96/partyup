import type { Locale } from "@/i18n/config";
import { dictionary as en } from "@/i18n/dictionaries/en";
import { dictionary as pt, type Dictionary } from "@/i18n/dictionaries/pt";

const dictionaries: Record<Locale, Dictionary> = { pt, en };

/** Seguro para Client Components — sem next/headers */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary } from "@/i18n/dictionaries/pt";
