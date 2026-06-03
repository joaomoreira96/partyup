"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { formatRecordScore } from "@/lib/profile/public-display";
import type { PersonalRecord } from "@/types/platform";

export function PublicRecords({ records }: { records: PersonalRecord[] }) {
  const { t } = useI18n();

  if (records.length === 0) return null;

  return (
    <section aria-labelledby="records-heading">
      <h2 id="records-heading" className="text-xl font-bold">
        {t("publicProfile.records")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {records.map((record) => (
          <li key={record.gameId} className="party-card flex gap-3 p-4">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent/15 text-accent"
              aria-hidden
            >
              <Trophy className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{record.gameName}</p>
              <p className="text-lg font-bold tabular-nums">
                {formatRecordScore(record.score, record.metric)}
              </p>
              <Link
                href={`/rankings/${record.slug}`}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {t("publicProfile.seeRanking")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
