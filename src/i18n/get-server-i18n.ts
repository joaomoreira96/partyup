import "server-only";

import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { translate } from "@/i18n/translate";

/** Apenas Server Components / Route Handlers */
export async function getServerI18n() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return {
    locale,
    dict,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(dict, key, params),
  };
}
