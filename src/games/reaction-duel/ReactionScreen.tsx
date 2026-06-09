"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import type { DuelPhase } from "@/lib/rooms/duel-state";

type ReactionScreenProps = {
  phase: DuelPhase;
  disabled?: boolean;
  clicked?: boolean;
  onTap: () => void;
};

export function ReactionScreen({
  phase,
  disabled,
  clicked,
  onTap,
}: ReactionScreenProps) {
  const { t } = useI18n();

  if (clicked) {
    return (
      <div
        className="flex min-h-[min(60vh,420px)] w-full flex-col items-center justify-center rounded-2xl border-4 border-white/20 bg-[#1e3a8a] px-6 text-center text-white shadow-lg"
        role="status"
        aria-live="polite"
      >
        <Check className="mb-4 size-16 stroke-[2.5]" aria-hidden />
        <p className="text-2xl font-bold sm:text-4xl">{t("gameModules.reactionDuel.clicked")}</p>
        <p className="mt-3 text-base font-normal text-white/80 sm:text-lg">
          {t("gameModules.reactionDuel.clickedHint")}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {t("gameModules.reactionDuel.noMoreClicks")}
        </p>
      </div>
    );
  }

  const phaseStyles: Record<string, { bg: string; labelKey: string }> = {
    waiting_red: { bg: "#dc2626", labelKey: "gameModules.reactionDuel.red" },
    green: { bg: "#16a34a", labelKey: "gameModules.reactionDuel.green" },
  };
  const style = phaseStyles[phase] ?? phaseStyles.waiting_red;
  const label = t(style.labelKey);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      className="flex min-h-[min(60vh,420px)] w-full min-w-[64px] touch-manipulation flex-col items-center justify-center rounded-2xl border-4 border-white/20 text-2xl font-bold text-white shadow-lg transition-transform active:scale-[0.99] disabled:opacity-70 sm:text-4xl"
      style={{ backgroundColor: style.bg }}
      aria-label={label}
    >
      {label}
    </button>
  );
}
