import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { SkipLink } from "@/components/layout/skip-link";
import { getLocale } from "@/i18n/get-locale";
import { getServerI18n } from "@/i18n/get-server-i18n";
import { colors } from "@/lib/design/tokens";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, dict } = await getServerI18n();
  return {
    title: {
      default: t("meta.siteTitle"),
      template: `%s | ${t("common.siteName")}`,
    },
    description: dict.meta.siteDescription,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: colors.background },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers locale={locale}>
          <SkipLink />
          <Navbar />
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
          <Toaster richColors closeButton position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
