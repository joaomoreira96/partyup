"use client";

import type { ComponentType } from "react";
import { Medal, Star, Trophy, Users } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import type { Achievement } from "@/types/platform";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  users: Users,
};

export function AchievementsGrid({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";

  return (
    <section aria-labelledby="achievements-heading" className="mt-10">
      <h2 id="achievements-heading" className="text-xl font-bold">
        {t("profile.achievements")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon ?? "trophy"] ?? Trophy;
          const unlocked = Boolean(a.unlocked_at);
          return (
            <li
              key={a.id}
              className={cn(
                "party-card flex gap-3 p-4",
                unlocked
                  ? "ring-1 ring-success/30"
                  : "opacity-60 grayscale motion-reduce:grayscale-0"
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                  unlocked
                    ? "bg-success/15 text-success"
                    : "bg-surface-hover text-muted-foreground"
                )}
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{a.name}</h3>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                {unlocked && a.unlocked_at && (
                  <p className="mt-1 text-xs text-success">
                    {t("profile.unlockedAt", {
                      date: new Date(a.unlocked_at).toLocaleDateString(dateLocale),
                    })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
