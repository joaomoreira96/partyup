"use client";

import { useCallback, useState } from "react";
import { getGuestName } from "@/lib/guest";

type RoomAction = "join" | "ready" | "start";

export function useRoom(code: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(
    async (action: RoomAction) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/rooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            action,
            guestName: getGuestName(),
          }),
        });
        if (!res.ok) {
          setError(
            action === "ready"
              ? "Inicia sessão para marcar pronto."
              : action === "start"
                ? "Apenas o anfitrião pode iniciar."
                : "Não foi possível entrar na sala."
          );
          return { ok: false as const };
        }
        return { ok: true as const, data: await res.json() };
      } catch {
        setError("Ligação indisponível. Tenta novamente.");
        return { ok: false as const };
      } finally {
        setLoading(false);
      }
    },
    [code]
  );

  const join = useCallback(() => runAction("join"), [runAction]);
  const ready = useCallback(() => runAction("ready"), [runAction]);
  const start = useCallback(() => runAction("start"), [runAction]);

  return { loading, error, join, ready, start };
}
