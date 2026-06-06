"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function maskCode(code: string): string {
  return "•".repeat(Math.max(code.length, 6));
}

type RoomCodeDisplayProps = {
  code: string;
  variant?: "hero" | "inline";
  className?: string;
};

export function RoomCodeDisplay({
  code,
  variant = "hero",
  className,
}: RoomCodeDisplayProps) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);

  const toggleLabel = revealed ? t("room.hideCode") : t("room.revealCode");
  const displayValue = revealed ? code : maskCode(code);

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span className="text-muted-foreground">{t("games.roomLabelPrefix")}</span>
        <span
          className="font-mono font-semibold tracking-wider"
          aria-hidden={!revealed}
        >
          {displayValue}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={toggleLabel}
          aria-pressed={revealed}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? (
            <EyeOff className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
        </Button>
      </span>
    );
  }

  return (
    <div className={cn("text-center", className)}>
      <p className="text-sm text-muted-foreground">{t("room.roomCodeLabel")}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <p
          className="font-mono text-3xl font-bold tracking-[0.2em] text-primary sm:text-4xl"
          aria-hidden={!revealed}
        >
          {displayValue}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label={toggleLabel}
          aria-pressed={revealed}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>
      <span className="sr-only">
        {revealed
          ? `${t("room.roomCodeLabel")}: ${code}`
          : t("room.codeHidden")}
      </span>
    </div>
  );
}
