"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { loadGameModule } from "@/lib/games/registry";
import { createPartyUpSDK, PartyUpSdkError } from "@/lib/partyup-sdk";
import { getGuestId, getGuestName } from "@/lib/guest";
import { getMaxScoreForModule, getMetricForGame } from "@/lib/games/metrics";
import type { GameRecord } from "@/types/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/page-states";

interface GamePlayerProps {
  game: GameRecord;
  userId?: string;
  userDisplayName?: string;
  isGuest: boolean;
  roomCode?: string;
}

export function GamePlayer({
  game,
  userId,
  userDisplayName,
  isGuest,
  roomCode,
}: GamePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [guestName, setGuestNameState] = useState("Convidado");
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const displayName = userDisplayName ?? guestName;

  const showFriendlyError = useCallback((err: unknown) => {
    if (err instanceof PartyUpSdkError) {
      setError(err.userMessage);
    } else {
      setError("Não foi possível carregar o jogo. Tenta novamente.");
    }
  }, []);

  useEffect(() => {
    if (isGuest) setGuestNameState(getGuestName());
  }, [isGuest]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    async function mount() {
      setLoading(true);
      setError(null);

      const module = await loadGameModule(game.module_id);
      if (!module || !containerRef.current || !mounted) {
        setError("Este jogo não está disponível de momento.");
        setLoading(false);
        return;
      }

      const metric = getMetricForGame(game.module_id);
      const sdk = createPartyUpSDK({
        gameId: game.id,
        moduleId: game.module_id,
        metric,
        maxScore: getMaxScoreForModule(game.module_id),
        user: {
          id: userId,
          displayName,
          isGuest,
        },
        room: roomCode
          ? { code: roomCode, status: "playing", players: [] }
          : undefined,
        onScoreUpdate: (score) => {
          setStatusHint(`Pontuação: ${Math.round(score)}`);
        },
        onLifecycleChange: (state) => {
          if (state === "PLAYING") setStatusHint(null);
        },
      });

      const wrapper = document.createElement("div");
      wrapper.className =
        "game-module-root w-full min-h-[240px] [--game-safe-top:env(safe-area-inset-top)]";
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(wrapper);

      try {
        cleanup = module.mount({
          container: wrapper,
          displayName,
          sdk,
          userId,
          isGuest,
          roomId: roomCode,
          multiplayer: Boolean(roomCode),
        });
      } catch (err) {
        showFriendlyError(err);
      }

      setLoading(false);
    }

    void mount();

    return () => {
      mounted = false;
      cleanup?.();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [
    game.id,
    game.module_id,
    displayName,
    userId,
    isGuest,
    roomCode,
    showFriendlyError,
  ]);

  if (!game.guest_allowed && isGuest) {
    return (
      <div className="party-card p-6 text-center">
        <p className="mb-4 text-muted-foreground">Este jogo requer conta.</p>
        <Button asChild>
          <Link href="/register">Criar conta grátis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isGuest && (
        <div className="party-card flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="guest-name">Nome no jogo</Label>
            <Input
              id="guest-name"
              defaultValue={guestName}
              onBlur={(e) => {
                const name = e.target.value || "Convidado";
                localStorage.setItem("partyup_guest_name", name);
                setGuestNameState(name);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:max-w-xs">
            Modo convidado — sem rankings oficiais.
          </p>
        </div>
      )}

      {statusHint && (
        <p className="text-sm text-muted-foreground" role="status">
          {statusHint}
        </p>
      )}

      {error ? (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-4"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : loading ? (
        <LoadingState label="A carregar jogo..." />
      ) : (
        <div
          ref={containerRef}
          className="w-full rounded-[var(--radius-premium)] border border-border bg-card p-4"
          aria-label={`Área de jogo: ${game.name}`}
        />
      )}
    </div>
  );
}
