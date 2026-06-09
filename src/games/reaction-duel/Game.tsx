"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PartyUpSDK } from "@/lib/partyup-sdk";
import { Countdown } from "@/games/reaction-duel/Countdown";
import { REACTION_DUEL_SLUG } from "@/games/reaction-duel/constants";
import { ReactionScreen } from "@/games/reaction-duel/ReactionScreen";
import { Results } from "@/games/reaction-duel/Results";
import { useI18n } from "@/features/i18n/locale-provider";
import { useDisplayDuelPhase } from "@/hooks/use-display-duel-phase";
import { useDuelRoom } from "@/hooks/use-duel-room";
import { useRoom, type RoomStatsRecordInfo } from "@/hooks/use-room";
import { isLocalHost } from "@/lib/rooms/host";
import { getRoomPlayerId } from "@/lib/rooms/player-session";
import { beginRoomTransition } from "@/lib/rooms/leave-room";
import { clearDuelMetadataCache } from "@/lib/rooms/duel-meta-cache";
import { parseDuelMetadata, type DuelPlayerResult } from "@/lib/rooms/duel-state";
import {
  countUniqueResults,
  DUEL_ROUND_SIZE,
  isRoundComplete,
  mergeDuelResults,
  resolveResultsNeeded,
  withRoundPhase,
} from "@/lib/rooms/round-completion";
import { RoomCodeDisplay } from "@/features/rooms/components/room-code-display";

type GameProps = {
  roomCode: string;
  gameId: string;
  userId?: string;
  isGuest: boolean;
  sdk: PartyUpSDK;
};

export function Game({ roomCode, sdk }: GameProps) {
  const { t } = useI18n();
  const {
    metadata,
    players,
    phase,
    status,
    error,
    refresh,
    patchMetadata,
    hostUserId,
    maxPlayers,
  } = useDuelRoom(roomCode);
  const displayPhase = useDisplayDuelPhase(metadata, phase, players.length, maxPlayers);
  const { click, rematch, recordStats, loading, playerId } = useRoom(roomCode);
  const [started, setStarted] = useState(false);
  const [clickedPending, setClickedPending] = useState(false);
  const [optimisticResults, setOptimisticResults] = useState<DuelPlayerResult[]>([]);
  const [statsInfo, setStatsInfo] = useState<RoomStatsRecordInfo | null>(null);
  const statsRequestedRef = useRef(false);
  const greenEmittedRef = useRef(false);
  const localPlayerId = playerId ?? getRoomPlayerId(roomCode);
  const isHost = isLocalHost(localPlayerId, players, hostUserId);

  const lobbyUrl = `/rooms/${roomCode}?game=${REACTION_DUEL_SLUG}`;
  const roundCtx = useMemo(
    () => ({ playerCount: players.length, maxPlayers }),
    [players.length, maxPlayers]
  );

  const effectiveResults = useMemo(
    () => mergeDuelResults(metadata.results, optimisticResults),
    [metadata.results, optimisticResults]
  );

  const effectiveMetadata = useMemo(
    () => withRoundPhase({ ...metadata, results: effectiveResults }, roundCtx),
    [metadata, effectiveResults, roundCtx]
  );

  const resultsNeeded = resolveResultsNeeded(effectiveMetadata, roundCtx);
  const submittedCount = countUniqueResults(effectiveResults);
  const roundComplete =
    status === "finished" ||
    phase === "results" ||
    metadata.phase === "results" ||
    countUniqueResults(effectiveResults) >= DUEL_ROUND_SIZE ||
    isRoundComplete(effectiveMetadata, roundCtx);

  const localHasSubmitted =
    clickedPending ||
    effectiveResults.some((r) => r.playerId === localPlayerId);

  useEffect(() => {
    if (phase === "scheduled" || phase === "countdown" || phase === "waiting_red") {
      setClickedPending(false);
      setOptimisticResults([]);
      setStatsInfo(null);
      statsRequestedRef.current = false;
    }
  }, [phase, metadata.roundId]);

  useEffect(() => {
    if (
      (phase === "scheduled" || phase === "countdown") &&
      metadata.countdownStartAt &&
      !started
    ) {
      setStarted(true);
      void sdk.startGame().catch(() => undefined);
      sdk.emit("ROOM_STARTED", { code: roomCode });
    }
  }, [phase, started, sdk, roomCode, metadata.countdownStartAt]);

  useEffect(() => {
    if (displayPhase === "green" && !greenEmittedRef.current) {
      greenEmittedRef.current = true;
      sdk.emit("SCORE_SUBMITTED", { phase: "green" });
    }
  }, [displayPhase, sdk]);

  useEffect(() => {
    if (!started) return;
    if (status !== "waiting" || phase !== "lobby") return;

    clearDuelMetadataCache(roomCode);
    beginRoomTransition(roomCode);
    window.location.href = lobbyUrl;
  }, [started, status, phase, roomCode, lobbyUrl]);

  useEffect(() => {
    if (!started || phase !== "lobby" || status !== "waiting") return;

    const id = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(id);
  }, [started, phase, status, refresh]);

  useEffect(() => {
    if (roundComplete) return;
    if (!started) return;
    if (phase !== "green" && phase !== "waiting_red" && !localHasSubmitted) return;

    const id = window.setInterval(() => void refresh(), 800);
    return () => window.clearInterval(id);
  }, [roundComplete, started, phase, localHasSubmitted, refresh]);

  const applyClickResponse = useCallback(
    (data: {
      metadata?: unknown;
      result?: DuelPlayerResult;
      stats?: RoomStatsRecordInfo | null;
    }) => {
      if (data.result) {
        setOptimisticResults((prev) => mergeDuelResults(prev, [data.result!]));
      }

      if (data.metadata) {
        const parsed = parseDuelMetadata(data.metadata);
        patchMetadata(
          data.metadata,
          parsed.phase === "results" ? "finished" : undefined
        );
      }

      if (data.stats) {
        setStatsInfo(data.stats);
      }
    },
    [patchMetadata]
  );

  useEffect(() => {
    if (!roundComplete || statsRequestedRef.current) return;
    statsRequestedRef.current = true;

    void (async () => {
      const result = await recordStats();
      if (result.ok && result.data?.stats) {
        setStatsInfo(result.data.stats);
      } else if (!result.ok) {
        setStatsInfo({
          ok: false,
          error: result.data?.error ?? "Não foi possível gravar estatísticas.",
        });
      }
    })();
  }, [roundComplete, recordStats]);

  const handleTap = useCallback(async () => {
    if (!localPlayerId) return;
    if (displayPhase !== "green") return;
    if (localHasSubmitted) return;

    setClickedPending(true);
    const result = await click(Date.now());
    if (result.ok) {
      applyClickResponse({
        metadata: result.data?.metadata,
        result: result.data?.result as DuelPlayerResult | undefined,
        stats: result.data?.stats ?? null,
      });
    } else {
      setClickedPending(false);
    }
  }, [click, localPlayerId, displayPhase, localHasSubmitted, applyClickResponse]);

  const handlePlayAgain = useCallback(async () => {
    greenEmittedRef.current = false;
    setClickedPending(false);
    setOptimisticResults([]);
    setStarted(false);
    clearDuelMetadataCache(roomCode);

    if (isHost) {
      const result = await rematch();
      if (!result.ok) return;
    }

    beginRoomTransition(roomCode);
    window.location.href = lobbyUrl;
  }, [isHost, rematch, roomCode, lobbyUrl]);

  if (!roomCode) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">{t("gameModules.reactionDuel.noRoom")}</p>
        <Link
          href={`/games/${REACTION_DUEL_SLUG}`}
          className="mt-4 inline-block text-primary underline"
        >
          {t("gameModules.reactionDuel.backToCatalog")}
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

  if (roundComplete) {
    return (
      <Results
        results={effectiveMetadata.results}
        winnerPlayerId={effectiveMetadata.winnerPlayerId}
        localPlayerId={localPlayerId}
        onPlayAgain={() => void handlePlayAgain()}
        loading={loading}
        statsInfo={statsInfo}
      />
    );
  }

  if (
    (phase === "scheduled" || phase === "countdown") &&
    metadata.countdownStartAt
  ) {
    return <Countdown countdownStartAt={metadata.countdownStartAt} />;
  }

  if (displayPhase === "waiting_red" || displayPhase === "green") {
    const waitingHint = t("gameModules.reactionDuel.clickedProgress", {
      submitted: submittedCount,
      needed: resultsNeeded,
    });

    return (
      <div className="space-y-4">
        <ReactionScreen
          phase={displayPhase}
          clicked={localHasSubmitted}
          disabled={localHasSubmitted || loading || displayPhase !== "green"}
          onTap={() => void handleTap()}
        />
        <p className="text-center text-xs text-muted-foreground">
          {localHasSubmitted
            ? waitingHint
            : `${t("gameModules.reactionDuel.playersCount", { count: players.length })} · ${
                displayPhase === "waiting_red"
                  ? t("gameModules.reactionDuel.dontClickYet")
                  : t("gameModules.reactionDuel.clickNow")
              }`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <p className="text-muted-foreground">{t("gameModules.reactionDuel.waiting")}</p>
      <div className="mt-2 flex justify-center">
        <RoomCodeDisplay code={roomCode} variant="inline" />
      </div>
      {status === "waiting" && started && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("gameModules.reactionDuel.returningToLobby")}
        </p>
      )}
      <Link href={lobbyUrl} className="mt-4 inline-block text-sm text-primary underline">
        {t("gameModules.reactionDuel.backToLobby")}
      </Link>
    </div>
  );
}
