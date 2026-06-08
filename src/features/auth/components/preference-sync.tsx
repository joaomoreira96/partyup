"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useUserContext } from "@/features/auth/components/user-provider";
import { useI18n } from "@/features/i18n/locale-provider";
import type { Locale } from "@/i18n/config";

const VALID_THEMES = ["light", "dark", "system"];

/**
 * Aplica as preferências (tema/idioma) guardadas no perfil quando o utilizador
 * inicia sessão. Só atua quando o user definiu explicitamente uma preferência.
 */
export function PreferenceSync() {
  const { profile } = useUserContext();
  const { setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) {
      appliedFor.current = null;
      return;
    }
    if (appliedFor.current === profile.id) return;
    appliedFor.current = profile.id;

    if (profile.theme && VALID_THEMES.includes(profile.theme)) {
      setTheme(profile.theme);
    }

    if (
      (profile.locale === "pt" || profile.locale === "en") &&
      profile.locale !== locale
    ) {
      setLocale(profile.locale as Locale);
    }
  }, [profile, setTheme, setLocale, locale]);

  return null;
}
