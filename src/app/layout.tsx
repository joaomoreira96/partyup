import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { SkipLink } from "@/components/layout/skip-link";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import { colors } from "@/lib/design/tokens";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Joga no browser`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: colors.background },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt"
      suppressHydrationWarning
      className={`${inter.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
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
