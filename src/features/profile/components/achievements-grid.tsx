"use client";

import { type ComponentType, useMemo, useState } from "react";
import { Clock, Crown, Flame, Medal, Star, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/locale-provider";
import { AchievementsPagination } from "@/features/profile/components/achievements-pagination";
import type { Achievement } from "@/types/platform";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  users: Users,
  clock: Clock,
  flame: Flame,
  crown: Crown,
};

const PAGE_SIZE = 6;

export function AchievementsGrid({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const [page, setPage] = useState(0);
  const [featured, setFeatured] = useState<Set<string>>(
    () => new Set(achievements.filter((a) => a.is_featured).map((a) => a.id))
  );
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Desbloqueadas primeiro; mantém a ordem original dentro de cada grupo.
  const ordered = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked_at);
    const locked = achievements.filter((a) => !a.unlocked_at);
    return [...unlocked, ...locked];
  }, [achievements]);

  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => ordered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [ordered, safePage]
  );

  async function toggleFeatured(id: string) {
    const nextFeatured = !featured.has(id);
    setFeatured((prev) => {
      const next = new Set(prev);
      if (nextFeatured) next.add(id);
      else next.delete(id);
      return next;
    });
    setPending((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/api/profile/achievements/feature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId: id, featured: nextFeatured }),
      });
      if (!res.ok) throw new Error("request_failed");
    } catch {
      // reverte em caso de erro
      setFeatured((prev) => {
        const next = new Set(prev);
        if (nextFeatured) next.delete(id);
        else next.add(id);
        return next;
      });
      toast.error(t("profile.featureError"));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <section aria-labelledby="achievements-heading" className="mt-10">
      <h2 id="achievements-heading" className="text-xl font-bold">
        {t("profile.achievements")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.featureHint")}</p>
      {achievements.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("profile.achievementsEmpty")}
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((a) => {
          const Icon = ICONS[a.icon ?? "trophy"] ?? Trophy;
          const unlocked = Boolean(a.unlocked_at);
          const isFeatured = featured.has(a.id);
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
              <div className="min-w-0 flex-1">
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
              {unlocked && (
                <button
                  type="button"
                  onClick={() => void toggleFeatured(a.id)}
                  disabled={pending.has(a.id)}
                  aria-pressed={isFeatured}
                  aria-label={
                    isFeatured
                      ? t("profile.removeFeatured")
                      : t("profile.addFeatured")
                  }
                  title={
                    isFeatured
                      ? t("profile.removeFeatured")
                      : t("profile.addFeatured")
                  }
                  className={cn(
                    "shrink-0 self-start rounded-[var(--radius-md)] p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    isFeatured
                      ? "text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star
                    className={cn("size-5", isFeatured && "fill-current")}
                    aria-hidden
                  />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <AchievementsPagination
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </section>
  );
}
