import { format } from "date-fns";
import { enUS, pt } from "date-fns/locale";
import { formatScoreForMetric } from "@/lib/games/types";
import type { Locale } from "@/i18n/config";
import type { LeaderboardMetric } from "@/types/platform";

export function formatMemberSince(createdAt: string, locale: Locale = "pt"): string {
  return format(new Date(createdAt), "MMM yyyy", {
    locale: locale === "en" ? enUS : pt,
  });
}

export function formatPlayTimeHours(seconds: number, locale: Locale = "pt"): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) {
    const label =
      hours === 1
        ? locale === "en"
          ? "hour"
          : "Hora"
        : locale === "en"
          ? "hours"
          : "Horas";
    return `${hours} ${label}`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function formatRecordScore(score: number, metric: LeaderboardMetric): string {
  return formatScoreForMetric(score, metric);
}
