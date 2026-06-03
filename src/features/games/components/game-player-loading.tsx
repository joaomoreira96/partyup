"use client";

import { LoadingState } from "@/components/shared/page-states";
import { useI18n } from "@/features/i18n/locale-provider";

export function GamePlayerLoading() {
  const { t } = useI18n();
  return <LoadingState label={t("games.play.loading")} />;
}
