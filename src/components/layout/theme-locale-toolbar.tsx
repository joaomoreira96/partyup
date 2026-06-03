"use client";

import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Tema + idioma lado a lado na navbar */
export function ThemeLocaleToolbar() {
  return (
    <div className="flex items-center gap-0.5">
      <LocaleToggle />
      <ThemeToggle />
    </div>
  );
}
