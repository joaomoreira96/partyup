"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PartyUpSDK } from "@/lib/partyup-sdk";
import {
  createInitialState,
  queueDirection,
  resetForNewRound,
  setPhase,
  tick,
} from "@/games/snake/SnakeEngine";
import type { Direction, SnakeGameState } from "@/games/snake/types";

type UseSnakeGameOptions = {
  sdk: PartyUpSDK;
  onGameOver: (state: SnakeGameState, durationMs: number) => void;
};

export function useSnakeGame({ sdk, onGameOver }: UseSnakeGameOptions) {
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const startedAtRef = useRef<number | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const clearTickTimer = useCallback(() => {
    if (tickTimerRef.current) {
      clearTimeout(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const scheduleTick = useCallback(() => {
    clearTickTimer();
    const current = stateRef.current;
    if (current.phase !== "PLAYING") return;

    tickTimerRef.current = setTimeout(() => {
      const result = tick(stateRef.current);
      stateRef.current = result.state;
      setState(result.state);

      if (result.kind === "game_over") {
        clearTickTimer();
        const durationMs = startedAtRef.current
          ? Date.now() - startedAtRef.current
          : 0;
        onGameOverRef.current(result.state, durationMs);
        return;
      }

      if (result.state.score !== current.score) {
        void sdk.submitScore({ score: result.state.score, metric: "score" }).catch(() => {
          sdk.emit("SCORE_SUBMITTED", { score: result.state.score, pending: true });
        });
      }

      scheduleTick();
    }, current.tickMs);
  }, [clearTickTimer, sdk]);

  useEffect(() => {
    if (state.phase === "PLAYING") {
      scheduleTick();
    } else {
      clearTickTimer();
    }
    return clearTickTimer;
  }, [state.phase, state.tickMs, scheduleTick, clearTickTimer]);

  const handleDirection = useCallback((direction: Direction) => {
    setState((prev) => {
      const next = queueDirection(prev, direction);
      stateRef.current = next;
      return next;
    });
  }, []);

  const startRound = useCallback(async () => {
    const next = setPhase(resetForNewRound(), "PLAYING");
    stateRef.current = next;
    setState(next);
    startedAtRef.current = Date.now();

    try {
      await sdk.startGame();
    } catch {
      const idle = setPhase(createInitialState(), "IDLE");
      stateRef.current = idle;
      setState(idle);
      startedAtRef.current = null;
    }
  }, [sdk]);

  const showIdle = useCallback(() => {
    clearTickTimer();
    const idle = setPhase(createInitialState(), "IDLE");
    stateRef.current = idle;
    setState(idle);
    startedAtRef.current = null;
  }, [clearTickTimer]);

  const playAgain = useCallback(() => {
    void startRound();
  }, [startRound]);

  return {
    state,
    handleDirection,
    startRound,
    showIdle,
    playAgain,
  };
}
