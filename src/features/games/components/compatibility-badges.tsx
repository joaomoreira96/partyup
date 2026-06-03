import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GameRecord } from "@/types/platform";
import { cn } from "@/lib/utils";

const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, onKey: "supports_desktop" as const },
  { key: "tablet", label: "Tablet", icon: Tablet, onKey: "supports_tablet" as const },
  { key: "mobile", label: "Mobile", icon: Smartphone, onKey: "supports_mobile" as const },
];

export function CompatibilityBadges({ game }: { game: GameRecord }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Compatibilidade">
      {DEVICES.map(({ key, label, icon: Icon, onKey }) => {
        const on = game[onKey];
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
