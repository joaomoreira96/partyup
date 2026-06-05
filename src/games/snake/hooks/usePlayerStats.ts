"use client";

import { useEffect, useState } from "react";

export type PlayerStats = {
  bestScore: number;
  rank: number | null;
};

const EMPTY_STATS: PlayerStats = { bestScore: 0, rank: null };

export function usePlayerStats(gameId: string | undefined, userId?: string) {
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(Boolean(gameId && userId));

  useEffect(() => {
    if (!gameId || !userId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetch(`/api/games/${gameId}/personal-stats`)
      .then((res) => (res.ok ? res.json() : EMPTY_STATS))
      .then((data: PlayerStats) => {
        if (!cancelled) {
          setStats({
            bestScore: Number(data.bestScore) || 0,
            rank: data.rank ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStats(EMPTY_STATS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, userId]);

  return { stats, loading, setStats };
}
