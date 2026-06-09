"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gamepad2,
  LayoutDashboard,
  Newspaper,
  Package,
  Shield,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/security", label: "Segurança", icon: Shield },
  { href: "/admin/score-reviews", label: "Score Reviews", icon: Star },
  { href: "/admin/users", label: "Utilizadores", icon: Users },
  { href: "/admin/games", label: "Jogos", icon: Gamepad2 },
  { href: "/admin/game-submissions", label: "Submissões", icon: Package },
  { href: "/admin/news", label: "News", icon: Newspaper },
] as const;

const developerLinks = [
  {
    href: "/admin/game-submissions",
    label: "Submissões",
    icon: Package,
    exact: false,
  },
] as const;

type AdminSidebarProps = {
  isAdmin: boolean;
};

export function AdminSidebar({ isAdmin }: AdminSidebarProps) {
  const pathname = usePathname();
  const links = isAdmin ? adminLinks : developerLinks;

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <nav aria-label="Administração" className="space-y-1">
        {links.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
