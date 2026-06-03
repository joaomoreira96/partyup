"use client";

import type { ComponentType } from "react";
import { Flame, Medal, Star, Trophy } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import type { Achievement } from "@/types/platform";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  users: Star,
  flame: Flame,
};

export function PublicAchievements({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const { t } = useI18n();
  const unlocked = achievements.filter((a) => a.unlocked_at);

  return (
    <section aria-labelledby="public-achievements-heading">
      <h2 id="public-achievements-heading" className="text-xl font-bold">
        {t("publicProfile.achievements")}
      </h2>
      {unlocked.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("publicProfile.noAchievements")}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {unlocked.map((a) => {
            const Icon = ICONS[a.icon ?? "trophy"] ?? Trophy;
            return (
              <li
                key={a.id}
                className={cn(
                  "party-card flex gap-3 p-4 ring-1 ring-success/25",
                  "bg-gradient-to-br from-success/5 to-transparent"
                )}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-success/15 text-success"
                  aria-hidden
                >
                  <Icon className="size-6" />
                </span>
                <div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
