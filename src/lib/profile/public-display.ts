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

/** Formata tempo de jogo total (segundos → horas, minutos ou segundos). */
export function formatPlayTime(seconds: number, locale: Locale = "pt"): string {
  const sec = Math.max(0, Math.floor(seconds));

  if (sec === 0) {
    return locale === "en" ? "0 min" : "0 min";
  }

  const hours = Math.floor(sec / 3600);
  if (hours >= 1) {
    const label =
      hours === 1
        ? locale === "en"
          ? "hour"
          : "hora"
        : locale === "en"
          ? "hours"
          : "horas";
    return `${hours} ${label}`;
  }

  if (sec < 60) {
    return `${sec} ${locale === "en" ? "sec" : "s"}`;
  }

  const minutes = Math.round(sec / 60);
  return `${minutes} min`;
}

/** @deprecated Prefer formatPlayTime — mantido para imports existentes */
export function formatPlayTimeHours(seconds: number, locale: Locale = "pt"): string {
  return formatPlayTime(seconds, locale);
}

export function formatRecordScore(score: number, metric: LeaderboardMetric): string {
  return formatScoreForMetric(score, metric);
}
