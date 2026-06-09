"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getBuildOrigin, getGameBuildsPublicUrl } from "@/lib/games/build-url";
import { resolveGameModuleId } from "@/lib/games/resolve-module-id";
import { getMaxScoreForModule, getMetricForGame } from "@/lib/games/metrics";
import { attachIframeSdkBridge, pingIframeSdk } from "@/lib/partyup-sdk/iframe-bridge";
import type { PartyUpSdkInitPayload } from "@/lib/partyup-sdk/protocol";
import { createPartyUpSDK } from "@/lib/partyup-sdk";
import type { SdkUnlockedAchievement } from "@/lib/partyup-sdk";
import { showAchievementUnlockedToasts } from "@/lib/achievements/show-unlocked-toast";
import { endRoomTransition, leaveRoomSession } from "@/lib/rooms/leave-room";
import { getRoomPlayerId } from "@/lib/rooms/player-session";
import type { GameRecord } from "@/types/platform";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import { LoadingState } from "@/components/shared/page-states";

const IFRAME_SANDBOX = "allow-scripts allow-pointer-lock";
const HANDSHAKE_TIMEOUT_MS = 20_000;
export type GameRunnerProps = {
  game: GameRecord;
  userId?: string;
  userDisplayName: string;
  isGuest: boolean;
  roomCode?: string;
};

export function GameRunner({
  game,
  userId,
  userDisplayName,
  isGuest,
  roomCode,
}: GameRunnerProps) {
  const { t, locale } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const titleId = useId();

  const build = game.active_build;
  const buildPath = build?.build_url?.trim();
  const buildPublicUrl = buildPath ? getGameBuildsPublicUrl(buildPath) : null;
  const allowedOrigin = buildPublicUrl ? getBuildOrigin(buildPublicUrl) : null;
  const moduleId = resolveGameModuleId(game);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game-runner.tsx:mount',message:'GameRunner init state',data:{slug:game.slug,runtime:game.runtime,buildPath:buildPath??null,buildPublicUrl,allowedOrigin,hasActiveBuild:Boolean(build),supabaseBase:process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0,40)??'MISSING'},timestamp:Date.now(),hypothesisId:'H-A-build'})}).catch(()=>{});
  }, [game.slug, game.runtime, buildPath, buildPublicUrl, allowedOrigin, build]);
  // #endregion

  useEffect(() => {
    if (!buildPublicUrl || !allowedOrigin) {
      setError(t("games.unavailable"));
      setLoading(false);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    let bridgeCleanup: (() => void) | undefined;
    let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const metric = getMetricForGame(moduleId);
    const sdk = createPartyUpSDK({
      gameId: game.id,
      gameSlug: game.slug,
      moduleId,
      metric,
      maxScore: getMaxScoreForModule(moduleId),
      user: {
        id: userId,
        displayName: userDisplayName,
        isGuest,
      },
      room: roomCode
        ? { code: roomCode, status: "playing", players: [] }
        : undefined,
      onScoreUpdate: (score) => {
        if (!mounted) return;
        setStatusHint(t("games.scoreHint", { score: Math.round(score) }));
      },
      onLifecycleChange: (state) => {
        if (!mounted) return;
        if (state === "PLAYING") setStatusHint(null);
      },
      onEvent: (type, payload) => {
        if (type !== "ACHIEVEMENT_UNLOCKED" || !payload?.achievement) return;
        showAchievementUnlockedToasts(
          [payload.achievement as SdkUnlockedAchievement],
          { title: t("achievements.unlockedTitle") }
        );
      },
    });

    const initPayload: PartyUpSdkInitPayload = {
      user: {
        id: userId,
        displayName: userDisplayName,
        isGuest,
      },
      language: locale,
      game: {
        id: game.id,
        slug: game.slug,
        name: getGameName(game, locale),
        version: build?.version,
        metric,
        maxScore: getMaxScoreForModule(moduleId),
      },
      room: roomCode
        ? { code: roomCode, status: "playing", players: [] }
        : undefined,
      session: { id: sessionIdRef.current },
    };

    bridgeCleanup = attachIframeSdkBridge({
      iframe,
      allowedOrigin,
      init: initPayload,
      sdk,
      onReady: () => {
        if (!mounted) return;
        clearTimeout(handshakeTimer);
        // #region agent log
        fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game-runner.tsx:onReady',message:'Handshake complete, hiding loader',data:{slug:game.slug},timestamp:Date.now(),hypothesisId:'H-D-handshake',runId:'post-fix'})}).catch(()=>{});
        // #endregion
        setLoading(false);
      },
      onBridgeError: (message) => {
        if (!mounted) return;
        setError(message);
      },
    });

    setIframeSrc(buildPublicUrl);

    handshakeTimer = setTimeout(() => {
      if (!mounted) return;
      // #region agent log
      fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game-runner.tsx:handshakeTimeout',message:'Handshake timeout fired',data:{slug:game.slug,buildPublicUrl,allowedOrigin},timestamp:Date.now(),hypothesisId:'H-D-handshake'})}).catch(()=>{});
      // #endregion
      setLoading(false);
      setError(
        "O jogo não respondeu ao handshake SDK. Confirma que o build inclui partyup-sdk.js."
      );
    }, HANDSHAKE_TIMEOUT_MS);

    const onIframeLoad = () => {
      if (!mounted) return;
      pingIframeSdk(iframe);
      // #region agent log
      fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game-runner.tsx:iframeLoad',message:'iframe load event',data:{slug:game.slug,iframeSrc:iframe.src},timestamp:Date.now(),hypothesisId:'H-E-iframe404',runId:'post-fix'})}).catch(()=>{});
      // #endregion
    };

    iframe.addEventListener("load", onIframeLoad);

    return () => {
      mounted = false;
      clearTimeout(handshakeTimer);
      iframe.removeEventListener("load", onIframeLoad);
      bridgeCleanup?.();
      setIframeSrc(null);
    };
  }, [
    allowedOrigin,
    build?.version,
    buildPublicUrl,
    game,
    isGuest,
    locale,
    moduleId,
    roomCode,
    t,
    userDisplayName,
    userId,
  ]);

  useEffect(() => {
    if (!roomCode) return;

    endRoomTransition(roomCode);

    const onPageHide = () => leaveRoomSession(roomCode, getRoomPlayerId(roomCode));
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      leaveRoomSession(roomCode, getRoomPlayerId(roomCode));
    };
  }, [roomCode]);

  if (!buildPublicUrl || !allowedOrigin) {
    return (
      <div className="party-card p-6 text-center">
        <p className="text-muted-foreground">{t("games.unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statusHint && (
        <p className="text-sm text-muted-foreground" role="status">
          {statusHint}
        </p>
      )}

      {error && (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-4"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="relative w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex min-h-[min(70vh,640px)] items-center justify-center rounded-[var(--radius-premium)] border border-border bg-card/95">
            <LoadingState label={t("games.play.loading")} />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc ?? undefined}
          title={t("games.play.areaLabel", { name: getGameName(game, locale) })}
          aria-labelledby={titleId}
          aria-busy={loading}
          className="block w-full min-h-[min(70vh,640px)] rounded-[var(--radius-premium)] border border-border bg-black"
          sandbox={IFRAME_SANDBOX}
          allow="pointer-lock"
          referrerPolicy="no-referrer"
        />
        <span id={titleId} className="sr-only">
          {getGameName(game, locale)}
        </span>
      </div>
    </div>
  );
}
