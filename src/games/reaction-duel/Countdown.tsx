"use client";

import { useEffect, useState } from "react";
import { COUNTDOWN_MS } from "@/lib/rooms/duel-state";
import { useI18n } from "@/features/i18n/locale-provider";

type CountdownProps = {
  countdownStartAt: number;
};

export function Countdown({ countdownStartAt }: CountdownProps) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(id);
  }, []);

  const untilStart = countdownStartAt - now;

  if (untilStart > 0) {
    const secs = Math.max(1, Math.ceil(untilStart / 1000));
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8">
        <p className="text-sm text-muted-foreground">
          {t("gameModules.reactionDuel.countdown")}
        </p>
        <p className="mt-4 text-7xl font-bold tabular-nums text-primary sm:text-8xl">
          {secs}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("gameModules.reactionDuel.syncing")}
        </p>
      </div>
    );
  }

  const elapsed = now - countdownStartAt;
  const remainingMs = COUNTDOWN_MS - elapsed;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const display = remaining > 0 ? remaining : t("gameModules.reactionDuel.go");

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8">
      <p className="text-sm text-muted-foreground">
        {t("gameModules.reactionDuel.countdown321")}
      </p>
      <p className="mt-4 text-7xl font-bold tabular-nums text-primary sm:text-8xl">
        {display}
      </p>
    </div>
  );
}
