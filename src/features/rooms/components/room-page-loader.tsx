"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/locale-provider";

export function RoomPageLoader({ code }: { code: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const res = await fetch(`/api/rooms?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          if (!cancelled) setError(t("room.notFound"));
          return;
        }

        const data = (await res.json()) as {
          room?: { gameSlug?: string | null };
        };

        const slug = data.room?.gameSlug;
        if (slug && !cancelled) {
          router.replace(`/rooms/${code}?game=${encodeURIComponent(slug)}`);
          return;
        }

        if (!cancelled) setError(t("room.missingGame"));
      } catch {
        if (!cancelled) setError(t("room.offline"));
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [code, router, t]);

  if (error) {
    return (
      <p className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {t("common.loading")}
    </p>
  );
}
