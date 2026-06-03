"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import type { GameRecord } from "@/types/platform";
import { cn } from "@/lib/utils";

const DEVICE_KEYS = [
  { key: "desktop", labelKey: "compatibility.desktop", icon: Monitor, onKey: "supports_desktop" as const },
  { key: "tablet", labelKey: "compatibility.tablet", icon: Tablet, onKey: "supports_tablet" as const },
  { key: "mobile", labelKey: "compatibility.mobile", icon: Smartphone, onKey: "supports_mobile" as const },
];

export function CompatibilityBadges({ game }: { game: GameRecord }) {
  const { t } = useI18n();

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("games.detail.compatibility")}>
      {DEVICE_KEYS.map(({ key, labelKey, icon: Icon, onKey }) => {
        const on = game[onKey];
        const label = t(labelKey);
        return (
          <li key={key}>
            <Badge
              variant={on ? "default" : "outline"}
              className={cn(
                "gap-1",
                on ? "bg-primary/15 text-primary border-primary/30" : "opacity-50"
              )}
              title={label}
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
