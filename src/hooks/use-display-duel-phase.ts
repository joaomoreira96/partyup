"use client";

import { useEffect, useRef, useState } from "react";
import {
  COUNTDOWN_MS,
  DUEL_TICK_MS,
  LATE_JOIN_RED_MS,
  type DuelPhase,
  type DuelRoomMetadata,
  phaseFromTimestamps,
} from "@/lib/rooms/duel-state";
import { isRoundComplete } from "@/lib/rooms/round-completion";

/**
 * Fase efectiva para UI: jogadores que abrem a página tarde ainda veem
 * brevemente o ecrã vermelho antes do verde, para não clicarem às cegas.
 */
export function useDisplayDuelPhase(
  metadata: DuelRoomMetadata,
  serverPhase: DuelPhase,
  playerCount: number,
  maxPlayers: number
): DuelPhase {
  const pageLoadedAt = useRef(Date.now());
  const joinedLateRef = useRef(false);
  const [displayPhase, setDisplayPhase] = useState(serverPhase);
  const roundCtx = { playerCount, maxPlayers };

  useEffect(() => {
    if (!metadata.countdownStartAt || !metadata.greenAt) return;
    if (pageLoadedAt.current > metadata.countdownStartAt + COUNTDOWN_MS) {
      joinedLateRef.current = true;
    }
  }, [metadata.countdownStartAt, metadata.greenAt]);

  useEffect(() => {
    const tick = () => {
      if (isRoundComplete(metadata, roundCtx) || serverPhase === "results") {
        setDisplayPhase("results");
        return;
      }

      const now = Date.now();
      const phase = phaseFromTimestamps(metadata, now, roundCtx);

      if (
        joinedLateRef.current &&
        now - pageLoadedAt.current < LATE_JOIN_RED_MS &&
        (phase === "green" || phase === "waiting_red")
      ) {
        setDisplayPhase("waiting_red");
        return;
      }

      setDisplayPhase(phase);
    };

    tick();
    const id = window.setInterval(tick, DUEL_TICK_MS);
    return () => window.clearInterval(id);
  }, [metadata, serverPhase, playerCount, maxPlayers]);

  if (isRoundComplete(metadata, roundCtx) || serverPhase === "results") {
    return "results";
  }

  if (serverPhase === "lobby" || serverPhase === "scheduled") {
    return serverPhase;
  }

  if (
    serverPhase === "countdown" &&
    metadata.countdownStartAt &&
    Date.now() < metadata.countdownStartAt + COUNTDOWN_MS
  ) {
    return "countdown";
  }

  return displayPhase;
}
