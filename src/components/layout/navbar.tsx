"use client";

import Link from "next/link";
import { Gamepad2, LogIn, Menu, User } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/features/i18n/locale-provider";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeLocaleToolbar } from "@/components/layout/theme-locale-toolbar";
import { LogoutButton } from "@/features/auth/components/logout-button";

function NavProfileLink({
  displayName,
  username,
  onNavigate,
  className,
  viewProfileLabel,
}: {
  displayName: string;
  username?: string | null;
  onNavigate?: () => void;
  className?: string;
  viewProfileLabel: string;
}) {
  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-9 max-w-[10.5rem] flex-col justify-center gap-0.5 rounded-[var(--radius-md)]",
        "bg-surface px-3 py-2 ring-1 ring-border",
        "transition-colors hover:bg-surface-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "sm:max-w-[12rem]",
        className
      )}
    >
      <span className="truncate text-sm font-medium leading-tight">{displayName}</span>
      {username ? (
        <span className="truncate text-xs leading-tight text-muted-foreground">
          @{username}
        </span>
      ) : (
        <span className="text-xs leading-tight text-muted-foreground">
          {viewProfileLabel}
        </span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile } = useUser();
  const { t } = useI18n();

  return (
    <>
      {NAV_LINKS.filter((link) => !(user && link.href === "/profile")).map(
        (link) => (
          <Button
            key={link.href}
            variant="ghost"
            className="justify-start md:justify-center"
            asChild
            onClick={onNavigate}
          >
            <Link href={link.href}>{t(link.key)}</Link>
          </Button>
        )
      )}
      {user ? (
        <div className="flex w-full items-center gap-2 md:w-auto md:gap-1.5">
          <NavProfileLink
            displayName={profile?.display_name?.trim() || t("nav.profile")}
            username={profile?.username}
            onNavigate={onNavigate}
            viewProfileLabel={t("nav.viewProfile")}
            className="min-w-0 flex-1 md:flex-none md:max-w-[11rem]"
          />
          <LogoutButton
            className="h-9 shrink-0 justify-start px-2.5 md:justify-center"
            onDone={onNavigate}
          />
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            className="justify-start md:justify-center"
            asChild
            onClick={onNavigate}
          >
            <Link href="/login">
              <LogIn className="size-4" aria-hidden />
              <span className="lg:ml-2">{t("nav.login")}</span>
            </Link>
          </Button>
          <Button
            className="justify-start md:justify-center"
            asChild
            onClick={onNavigate}
          >
            <Link href="/register">
              <User className="size-4" aria-hidden />
              {t("nav.register")}
            </Link>
          </Button>
        </>
      )}
    </>
  );
}

export function Navbar() {
  const { t } = useI18n();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 shadow-[var(--shadow-card)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:max-w-7xl">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[var(--radius-md)]"
          aria-label={t("nav.homeAria", { siteName: t("common.siteName") })}
        >
          <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground shadow-sm">
            <Gamepad2 className="size-4" aria-hidden />
          </span>
          <span className="text-lg sm:text-xl">{t("common.siteName")}</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label={t("nav.mainNav")}
        >
          <NavLinks />
          <ThemeLocaleToolbar />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeLocaleToolbar />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={t("nav.openMenu")}>
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(100%,20rem)] border-border bg-card"
            >
              <SheetHeader>
                <SheetTitle>{t("common.siteName")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label={t("nav.mobileNav")}>
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
