"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PartyUpSDK } from "@/lib/partyup-sdk";
import { Arena, type ArenaLiveEntry } from "@/games/click-frenzy/Arena";
import { Countdown } from "@/games/click-frenzy/Countdown";
import { Results, type ResultEntry } from "@/games/click-frenzy/Results";
import { CLICK_FRENZY_SLUG } from "@/games/click-frenzy/constants";
import { useClickFrenzyRoom } from "@/games/click-frenzy/hooks/useClickFrenzyRoom";
import {
  finishClickFrenzy,
  resetClickFrenzy,
  submitClickFrenzyScore,
} from "@/games/click-frenzy/services/click-frenzy-sync";
import {
  CLICK_FRENZY_SYNC_MS,
  rankClickFrenzyScores,
  type ClickFrenzyScore,
} from "@/lib/rooms/click-frenzy-state";
import { isLocalHost } from "@/lib/rooms/host";
import { roomPlayerLabel } from "@/lib/rooms/player-label";
import { getRoomPlayerId } from "@/lib/rooms/player-session";
import { beginRoomTransition } from "@/lib/rooms/leave-room";
import { RoomCodeDisplay } from "@/features/rooms/components/room-code-display";

type GameProps = {
  roomCode: string;
  gameId: string;
  userId?: string;
  isGuest: boolean;
  sdk: PartyUpSDK;
};

export function Game({ roomCode, sdk }: GameProps) {
  const { metadata, players, phase, now, hostUserId, error, patchMetadata, refresh } =
    useClickFrenzyRoom(roomCode);

  const localPlayerId = getRoomPlayerId(roomCode);
  const isHost = isLocalHost(localPlayerId, players, hostUserId);
  const lobbyUrl = `/rooms/${roomCode}?game=${CLICK_FRENZY_SLUG}`;

  const [displayClicks, setDisplayClicks] = useState(0);
  const [displayLastClickAt, setDisplayLastClickAt] = useState(0);
  const [resetting, setResetting] = useState(false);
  const localClicksRef = useRef(0);
  const lastClickAtRef = useRef(0);
  const lastSubmittedRef = useRef(0);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const initializedRef = useRef(false);

  const labelByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => map.set(p.id, roomPlayerLabel(p)));
    return map;
  }, [players]);

  // Inicia a sessao (lifecycle/eventos da plataforma) uma unica vez.
  useEffect(() => {
    if (startedRef.current) return;
    if (phase === "countdown" || phase === "playing") {
      startedRef.current = true;
      void sdk.startGame().catch(() => undefined);
    }
  }, [phase, sdk]);

  // Recupera a contagem do servidor apos refresh durante o jogo.
  useEffect(() => {
    if (initializedRef.current) return;
    if (phase !== "playing" || !localPlayerId) return;
    const serverClicks = metadata.scores[localPlayerId]?.clicks ?? 0;
    localClicksRef.current = Math.max(localClicksRef.current, serverClicks);
    lastSubmittedRef.current = localClicksRef.current;
    setDisplayClicks(localClicksRef.current);
    initializedRef.current = true;
  }, [phase, localPlayerId, metadata.scores]);

  const handleTap = useCallback(() => {
    if (phase !== "playing") return;
    if (metadata.endAt && Date.now() >= metadata.endAt) return;
    const at = Date.now();
    localClicksRef.current += 1;
    lastClickAtRef.current = at;
    setDisplayClicks(localClicksRef.current);
    setDisplayLastClickAt(at);
  }, [phase, metadata.endAt]);

  // Sincronizacao periodica da pontuacao para o servidor.
  useEffect(() => {
    if (phase !== "playing" || !localPlayerId) return;

    const id = window.setInterval(() => {
      if (localClicksRef.current <= lastSubmittedRef.current) return;
      const clicks = localClicksRef.current;
      const lastAt = lastClickAtRef.current;
      lastSubmittedRef.current = clicks;
      void submitClickFrenzyScore(roomCode, localPlayerId, clicks, lastAt).then(
        (res) => {
          if (res.ok && res.data.metadata) patchMetadata(res.data.metadata);
        }
      );
    }, CLICK_FRENZY_SYNC_MS);

    return () => window.clearInterval(id);
  }, [phase, localPlayerId, roomCode, patchMetadata]);

  // Fecho da partida: submissao final + gravacao de sessoes (idempotente).
  useEffect(() => {
    if (phase !== "results" || finishedRef.current) return;
    if (!metadata.endAt) return;
    finishedRef.current = true;

    void (async () => {
      if (localPlayerId && localClicksRef.current > lastSubmittedRef.current) {
        lastSubmittedRef.current = localClicksRef.current;
        await submitClickFrenzyScore(
          roomCode,
          localPlayerId,
          localClicksRef.current,
          lastClickAtRef.current
        );
      }
      // Pequena margem para garantir que o relogio do servidor passou o fim.
      await new Promise((r) => setTimeout(r, 700));
      const res = await finishClickFrenzy(roomCode);
      if (res.ok && res.data.metadata) {
        patchMetadata(res.data.metadata, "finished");
      } else {
        void refresh();
      }
    })();
  }, [phase, metadata.endAt, localPlayerId, roomCode, patchMetadata, refresh]);

  // Apos reset do anfitriao, todos voltam ao lobby.
  useEffect(() => {
    if (phase === "lobby" && metadata.recorded === false && !metadata.countdownStartAt) {
      // Evita redirecionar antes do primeiro fetch (estado inicial).
      if (players.length === 0) return;
      beginRoomTransition(roomCode);
      window.location.href = lobbyUrl;
    }
  }, [phase, metadata.recorded, metadata.countdownStartAt, players.length, roomCode, lobbyUrl]);

  const handlePlayAgain = useCallback(async () => {
    if (isHost) {
      setResetting(true);
      await resetClickFrenzy(roomCode);
    }
    beginRoomTransition(roomCode);
    window.location.href = lobbyUrl;
  }, [isHost, roomCode, lobbyUrl]);

  if (!roomCode) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">Sala não encontrada.</p>
        <Link href={`/games/${CLICK_FRENZY_SLUG}`} className="mt-4 inline-block text-primary underline">
          Voltar ao jogo
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        {error}
      </div>
    );
  }

  if (phase === "countdown" && metadata.startAt) {
    return <Countdown startAt={metadata.startAt} />;
  }

  if (phase === "playing") {
    const selfServer = localPlayerId ? metadata.scores[localPlayerId]?.clicks ?? 0 : 0;
    const selfClicks = Math.max(displayClicks, selfServer);

    const merged: Record<string, ClickFrenzyScore> = { ...metadata.scores };
    if (localPlayerId) {
      merged[localPlayerId] = {
        clicks: selfClicks,
        lastClickAt: displayLastClickAt,
      };
    }

    const ranked = rankClickFrenzyScores(merged);
    const ranking: ArenaLiveEntry[] = players.map((p) => {
      const entry = ranked.find((r) => r.playerId === p.id);
      return {
        playerId: p.id,
        name: labelByPlayer.get(p.id) ?? "Jogador",
        clicks: entry?.clicks ?? 0,
        isSelf: p.id === localPlayerId,
      };
    });
    ranking.sort((a, b) => b.clicks - a.clicks);

    const position =
      ranked.find((r) => r.playerId === localPlayerId)?.rank ?? players.length;
    const timeLeft = metadata.endAt ? metadata.endAt - now : 0;

    return (
      <Arena
        timeLeftMs={timeLeft}
        score={displayClicks}
        position={position}
        totalPlayers={Math.max(players.length, 1)}
        ranking={ranking}
        disabled={timeLeft <= 0}
        onTap={handleTap}
      />
    );
  }

  if (phase === "results") {
    const merged: Record<string, ClickFrenzyScore> = {};
    players.forEach((p) => {
      merged[p.id] = metadata.scores[p.id] ?? { clicks: 0, lastClickAt: 0 };
    });
    // Inclui tambem ids que possam existir em scores sem player ativo.
    Object.entries(metadata.scores).forEach(([id, score]) => {
      if (!merged[id]) merged[id] = score;
    });

    const ranked = rankClickFrenzyScores(merged);
    const results: ResultEntry[] = ranked.map((r) => ({
      rank: r.rank,
      playerId: r.playerId,
      name: labelByPlayer.get(r.playerId) ?? "Jogador",
      clicks: r.clicks,
      isSelf: r.playerId === localPlayerId,
    }));

    return (
      <Results
        results={results}
        loading={resetting || !metadata.recorded}
        isHost={isHost}
        onPlayAgain={() => void handlePlayAgain()}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <p className="text-muted-foreground">A preparar a partida…</p>
      <div className="mt-2 flex justify-center">
        <RoomCodeDisplay code={roomCode} variant="inline" />
      </div>
      <Link href={lobbyUrl} className="mt-4 inline-block text-sm text-primary underline">
        Voltar ao lobby
      </Link>
    </div>
  );
}
