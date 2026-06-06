"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { buildPageSearchParams } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalItems?: number;
  rangeStart?: number;
  rangeEnd?: number;
  pageParam?: string;
  className?: string;
};

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  pageParam = "page",
  className,
}: PaginationControlsProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const prevHref = `${pathname}${buildPageSearchParams(searchParams, page - 1, pageParam)}`;
  const nextHref = `${pathname}${buildPageSearchParams(searchParams, page + 1, pageParam)}`;

  const summary =
    totalItems != null && rangeStart != null && rangeEnd != null && totalItems > 0
      ? t("pagination.showing", {
          start: rangeStart,
          end: rangeEnd,
          total: totalItems,
        })
      : t("pagination.pageOf", { page, total: totalPages });

  return (
    <nav
      aria-label={t("pagination.label")}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t pt-4",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4" aria-hidden />
            {t("pagination.previous")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={prevHref}>
              <ChevronLeft className="size-4" aria-hidden />
              {t("pagination.previous")}
            </Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            {t("pagination.next")}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref}>
              {t("pagination.next")}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
