"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export function AchievementsPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useI18n();

  if (pageCount <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("common.previous")}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("common.previous")}
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {t("common.pageOf", { page: String(page + 1), total: String(pageCount) })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("common.next")}
      >
        {t("common.next")}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
