"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/features/i18n/locale-provider";

export function Countdown({ startAt }: { startAt: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, startAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const label = seconds <= 0 ? t("clickFrenzy.go") : String(seconds);

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {t("clickFrenzy.prepare")}
      </p>
      <div
        key={label}
        className="flex size-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-6xl font-black text-primary-foreground shadow-lg animate-in zoom-in"
        aria-live="assertive"
      >
        {label}
      </div>
      <p className="text-muted-foreground">{t("clickFrenzy.tapFast")}</p>
    </div>
  );
}
