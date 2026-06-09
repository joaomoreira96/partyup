"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGameMusicUrl } from "@/lib/games/music";

const MUTED_KEY = "partyup_game_music_muted";
const DEFAULT_VOLUME = 0.35;

function readMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTED_KEY) === "true";
}

export function useGameMusic(moduleId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(readMutedPreference());
  const [muted, setMutedState] = useState(mutedRef.current);

  const setMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMutedState(value);
    localStorage.setItem(MUTED_KEY, String(value));
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = value;
    if (!value && audio.paused) {
      void audio.play().catch(() => {});
    }
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(!mutedRef.current);
  }, [setMuted]);

  useEffect(() => {
    if (!moduleId) return undefined;

    const src = getGameMusicUrl(moduleId);
    if (!src) return undefined;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.muted = mutedRef.current;
    audioRef.current = audio;

    const tryPlay = () => {
      void audio.play().catch(() => {});
    };

    tryPlay();

    const onInteraction = () => {
      if (audio.paused && !audio.muted) tryPlay();
    };

    document.addEventListener("pointerdown", onInteraction);

    return () => {
      document.removeEventListener("pointerdown", onInteraction);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [moduleId]);

  return { muted, toggleMuted };
}
