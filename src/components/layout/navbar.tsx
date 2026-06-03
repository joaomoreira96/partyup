"use client";

import Link from "next/link";
import { Gamepad2, LogIn, Menu, User } from "lucide-react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile } = useUser();

  return (
    <>
      {NAV_LINKS.map((link) => (
        <Button
          key={link.href}
          variant="ghost"
          className="justify-start md:justify-center"
          asChild
          onClick={onNavigate}
        >
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
      {user ? (
        <Button
          variant="secondary"
          className="justify-start md:justify-center"
          asChild
          onClick={onNavigate}
        >
          <Link href="/profile">{profile?.display_name ?? "Perfil"}</Link>
        </Button>
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
              <span className="lg:ml-2">Login</span>
            </Link>
          </Button>
          <Button
            className="justify-start md:justify-center"
            asChild
            onClick={onNavigate}
          >
            <Link href="/register">
              <User className="size-4" aria-hidden />
              Registar
            </Link>
          </Button>
        </>
      )}
    </>
  );
}

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 shadow-[var(--shadow-card)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:max-w-7xl">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[var(--radius-md)]"
          aria-label={`${SITE_NAME} — início`}
        >
          <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground shadow-sm">
            <Gamepad2 className="size-4" aria-hidden />
          </span>
          <span className="text-lg sm:text-xl">{SITE_NAME}</span>
        </Link>

        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Principal"
        >
          <NavLinks />
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Abrir menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(100%,20rem)] border-border bg-card"
            >
              <SheetHeader>
                <SheetTitle>{SITE_NAME}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
