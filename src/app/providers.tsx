"use client";

import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/features/i18n/locale-provider";
import { UserProvider } from "@/features/auth/components/user-provider";
import type { Locale } from "@/i18n/config";

export function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        storageKey="partyup-theme"
        disableTransitionOnChange
      >
        <UserProvider>{children}</UserProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
