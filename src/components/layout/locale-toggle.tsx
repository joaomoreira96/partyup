"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === "pt" ? "en" : "pt";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLocale(next)}
      aria-label={locale === "pt" ? t("locale.switchToEn") : t("locale.switchToPt")}
      title={locale === "pt" ? "English" : "Português"}
      className="relative font-semibold text-xs tracking-wide"
    >
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">{t("locale.label")}</span>
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded bg-primary px-1 py-px text-[9px] font-bold leading-none text-primary-foreground"
        aria-hidden
      >
        {locale.toUpperCase()}
      </span>
    </Button>
  );
}
