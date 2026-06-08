"use client";

import { useEffect, useState } from "react";

export function Countdown({ startAt }: { startAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, startAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const label = seconds <= 0 ? "GO" : String(seconds);

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Prepara-te
      </p>
      <div
        key={label}
        className="flex size-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-6xl font-black text-primary-foreground shadow-lg animate-in zoom-in"
        aria-live="assertive"
      >
        {label}
      </div>
      <p className="text-muted-foreground">Clica o mais rápido que conseguires!</p>
    </div>
  );
}
