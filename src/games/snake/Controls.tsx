"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { Direction } from "@/games/snake/types";

type ControlsProps = {
  onDirection: (direction: Direction) => void;
  disabled?: boolean;
};

function DirectionButton({
  direction,
  label,
  onDirection,
  disabled,
  children,
}: {
  direction: Direction;
  label: string;
  onDirection: (direction: Direction) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        onDirection(direction);
      }}
      className="flex size-14 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted active:scale-95 disabled:opacity-40 sm:size-16 touch-manipulation"
    >
      {children}
    </button>
  );
}

export function Controls({ onDirection, disabled }: ControlsProps) {
  return (
    <div
      className="mx-auto mt-4 grid max-w-[220px] grid-cols-3 grid-rows-3 gap-2 sm:max-w-[260px] md:hidden"
      aria-label="Controlos touch"
    >
      <div />
      <DirectionButton
        direction="up"
        label="Mover para cima"
        onDirection={onDirection}
        disabled={disabled}
      >
        <ChevronUp className="size-7" aria-hidden />
      </DirectionButton>
      <div />

      <DirectionButton
        direction="left"
        label="Mover para a esquerda"
        onDirection={onDirection}
        disabled={disabled}
      >
        <ChevronLeft className="size-7" aria-hidden />
      </DirectionButton>
      <DirectionButton
        direction="down"
        label="Mover para baixo"
        onDirection={onDirection}
        disabled={disabled}
      >
        <ChevronDown className="size-7" aria-hidden />
      </DirectionButton>
      <DirectionButton
        direction="right"
        label="Mover para a direita"
        onDirection={onDirection}
        disabled={disabled}
      >
        <ChevronRight className="size-7" aria-hidden />
      </DirectionButton>
    </div>
  );
}
