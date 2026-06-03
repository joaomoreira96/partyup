"use client";

import { useMemo } from "react";
import type { GameRecord } from "@/types/platform";

/** Client-side helpers for game presentation — no fetching here */
export function useGameCapabilities(game: GameRecord) {
  return useMemo(
    () => ({
      canPlayAsGuest: game.guest_allowed,
      hasMultiplayer: game.supports_multiplayer,
      devices: {
        desktop: game.supports_desktop,
        tablet: game.supports_tablet,
        mobile: game.supports_mobile,
      },
    }),
    [game]
  );
}
