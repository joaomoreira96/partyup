"use client";

import { type ComponentType, useMemo, useState } from "react";
import { Clock, Crown, Flame, Medal, Star, Trophy } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { AchievementsPagination } from "@/features/profile/components/achievements-pagination";
import type { Achievement } from "@/types/platform";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  clock: Clock,
  flame: Flame,
  crown: Crown,
};

const PAGE_SIZE = 6;

export function PublicAchievements({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const [page, setPage] = useState(0);

  const unlocked = useMemo(
    () =>
      achievements
        .filter((a) => a.unlocked_at && a.is_featured)
        .sort(
          (a, b) =>
            new Date(b.unlocked_at ?? 0).getTime() -
            new Date(a.unlocked_at ?? 0).getTime()
        ),
    [achievements]
  );

  const pageCount = Math.max(1, Math.ceil(unlocked.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => unlocked.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [unlocked, safePage]
  );

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
        <>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((a) => {
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
                  {a.unlocked_at ? (
                    <p className="mt-1 text-xs text-success">
                      {t("profile.unlockedAt", {
                        date: new Date(a.unlocked_at).toLocaleDateString(
                          dateLocale
                        ),
                      })}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <AchievementsPagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
        />
        </>
      )}
    </section>
  );
}
