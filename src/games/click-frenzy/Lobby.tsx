"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Play, Share2, Users } from "lucide-react";
import { countReadyPlayers, isLocalHost, playersAllReady } from "@/lib/rooms/host";
import { roomPlayerLabel } from "@/lib/rooms/player-label";
import { useRoom } from "@/hooks/use-room";
import { useClickFrenzyRoom } from "@/games/click-frenzy/hooks/useClickFrenzyRoom";
import { startClickFrenzy } from "@/games/click-frenzy/services/click-frenzy-sync";
import { CLICK_FRENZY_SLUG } from "@/games/click-frenzy/constants";
import { getStoredGuestName, setGuestName } from "@/lib/guest";
import {
  beginRoomTransition,
  endRoomTransition,
  leaveRoomSession,
} from "@/lib/rooms/leave-room";
import { getRoomPlayerId } from "@/lib/rooms/player-session";
import { useI18n } from "@/features/i18n/locale-provider";
import { getGameName } from "@/lib/game-localized";
import type { GameRecord, Profile } from "@/types/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoomCodeDisplay } from "@/features/rooms/components/room-code-display";
import { toast } from "sonner";

function registeredDisplayName(
  profile: Pick<Profile, "display_name" | "username">
): string {
  if (profile.display_name?.trim()) return profile.display_name.trim();
  if (profile.username?.trim()) return profile.username.trim();
  return "Jogador";
}

export function ClickFrenzyLobby({
  code,
  game,
  offline,
  profile,
}: {
  code: string;
  game: GameRecord;
  offline?: boolean;
  profile?: Pick<Profile, "display_name" | "username"> | null;
}) {
  const { t, locale } = useI18n();
  const isRegistered = !!profile;
  const [hydrated, setHydrated] = useState(false);
  const [guestName, setGuestNameState] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [readyPending, setReadyPending] = useState<boolean | null>(null);
  const [joinUrl, setJoinUrl] = useState(
    `/rooms/${code}?game=${encodeURIComponent(CLICK_FRENZY_SLUG)}`
  );

  const { players, hostUserId, maxPlayers, phase, error: syncError, refresh } =
    useClickFrenzyRoom(code);
  const { join, ready, unready, loading, error, playerId } = useRoom(code);

  const roomPath = `/rooms/${code}?game=${encodeURIComponent(CLICK_FRENZY_SLUG)}`;
  const playUrl = `/games/${CLICK_FRENZY_SLUG}/play?room=${encodeURIComponent(code)}`;

  useEffect(() => {
    setGuestNameState(getStoredGuestName());
    setHasJoined(!!getRoomPlayerId(code));
    setJoinUrl(`${window.location.origin}${roomPath}`);
    endRoomTransition(code);
    setHydrated(true);
  }, [code, roomPath]);

  // Quando a partida arranca, todos os jogadores entram na arena.
  useEffect(() => {
    if (!hydrated) return;
    if (!(hasJoined || isRegistered)) return;
    if (phase !== "countdown" && phase !== "playing") return;

    beginRoomTransition(code);
    window.location.href = playUrl;
  }, [hydrated, hasJoined, isRegistered, phase, code, playUrl]);

  const localPlayerId = playerId ?? (hydrated ? getRoomPlayerId(code) : null);
  const localPlayer = players.find((p) => p.id === localPlayerId);
  const isHost = isLocalHost(localPlayerId, players, hostUserId);
  const isReadyFromServer = localPlayer?.is_ready === true;
  const isReady = readyPending ?? isReadyFromServer;

  const readyCount = countReadyPlayers(players);
  const allReady = players.length >= 1 && playersAllReady(players);
  const isFull = players.length >= maxPlayers;
  const canStart = isHost && allReady && !loading;

  const trimmedGuestName = guestName.trim();
  const guestNameValid = isRegistered || trimmedGuestName.length >= 2;

  const doJoin = useCallback(async () => {
    if (!guestNameValid && !isRegistered) {
      toast.error(t("room.nameRequired"));
      return;
    }
    if (!isRegistered) setGuestName(trimmedGuestName);

    const result = await join();
    if (result.ok) {
      setHasJoined(true);
      void refresh();
    }
  }, [trimmedGuestName, guestNameValid, isRegistered, join, refresh, t]);

  useEffect(() => {
    if (!hydrated || !isRegistered) return;
    void doJoin();
  }, [hydrated, isRegistered, doJoin]);

  useEffect(() => {
    if (readyPending === null) return;
    if (isReadyFromServer === readyPending) setReadyPending(null);
  }, [readyPending, isReadyFromServer]);

  useEffect(() => {
    if (!hydrated || (!hasJoined && !isRegistered)) return;
    const interval = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(interval);
  }, [hydrated, hasJoined, isRegistered, refresh]);

  useEffect(() => {
    if (!hydrated) return;
    const onPageHide = () => {
      if (getRoomPlayerId(code)) leaveRoomSession(code);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (getRoomPlayerId(code)) leaveRoomSession(code);
    };
  }, [hydrated, code]);

  async function toggleReady() {
    const nextReady = !isReady;
    setReadyPending(nextReady);
    const result = nextReady ? await ready() : await unready();
    if (result.ok) {
      toast.success(nextReady ? t("room.readySuccess") : t("room.unreadySuccess"));
      void refresh();
    } else {
      setReadyPending(null);
      toast.error(error ?? t("room.actionFailed"));
    }
  }

  async function startGame() {
    const result = await startClickFrenzy(code, localPlayerId);
    if (result.ok && result.data.playUrl) {
      beginRoomTransition(code);
      window.location.href = result.data.playUrl;
      return;
    }
    const detail =
      result.data.detail && result.data.detail !== result.data.error
        ? ` (${result.data.detail})`
        : "";
    toast.error(`${result.data.error ?? error ?? t("room.hostOnly")}${detail}`);
  }

  function copyLink() {
    void navigator.clipboard.writeText(joinUrl);
    toast.success(t("room.linkCopied"));
  }

  const lobbyError = error ?? syncError;
  const playerCountLabel = t("room.playerCount", {
    count: String(players.length),
    max: String(maxPlayers),
  });
  const readyCountLabel = t("room.readyCount", {
    ready: String(readyCount),
    max: String(maxPlayers),
  });

  if (!hydrated) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("common.loading")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="party-card-premium border-secondary/20 bg-gradient-to-br from-secondary/10 to-transparent p-6 text-center">
        <RoomCodeDisplay code={code} />
        <p className="mt-2 text-sm font-medium">{getGameName(game, locale)}</p>
        {offline && (
          <p className="mt-3 text-xs text-warning" role="status">
            {t("room.offlineHint")}
          </p>
        )}
      </div>

      {lobbyError && (
        <p
          className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {lobbyError}
        </p>
      )}

      {isRegistered ? (
        <div className="party-card p-4">
          <p className="text-sm text-muted-foreground">{t("room.playingAs")}</p>
          <p className="mt-1 font-medium">{registeredDisplayName(profile)}</p>
        </div>
      ) : (
        <div className="party-card space-y-3 p-4">
          <div className="space-y-2">
            <Label htmlFor="guest-lobby-name">{t("room.yourName")}</Label>
            <Input
              id="guest-lobby-name"
              value={guestName}
              onChange={(e) => setGuestNameState(e.target.value)}
              onBlur={() => {
                setGuestName(guestName);
                if (hasJoined && guestName.trim().length >= 2) {
                  void join().then((r) => {
                    if (r.ok) void refresh();
                  });
                }
              }}
              placeholder={t("room.namePlaceholder")}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{t("room.nameHint")}</p>
          </div>
          {!hasJoined && (
            <Button
              className="w-full"
              disabled={loading || !guestNameValid || isFull}
              onClick={() => void doJoin()}
            >
              {isFull
                ? t("clickFrenzy.roomFull")
                : loading
                  ? t("common.loading")
                  : t("room.enterRoom")}
            </Button>
          )}
        </div>
      )}

      {(hasJoined || isRegistered) && (
        <>
          <div
            className={`party-card flex items-center gap-3 p-4 ${
              isReady ? "border-success/40 bg-success/10" : "border-border bg-surface"
            }`}
            role="status"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-full ${
                isReady
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isReady ? (
                <Check className="size-5" aria-hidden />
              ) : (
                <Users className="size-5" aria-hidden />
              )}
            </span>
            <div>
              <p className="font-medium">
                {isReady ? t("room.youAreReady") : t("room.youAreWaiting")}
              </p>
              <p className="text-sm text-muted-foreground">
                {isReady ? t("room.waitingForHost") : t("room.tapReadyHint")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={copyLink}>
              <Copy className="size-4" aria-hidden />
              {t("room.copyLink")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={copyLink}>
              <Share2 className="size-4" aria-hidden />
              {t("common.share")}
            </Button>
          </div>

          <div className="party-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-secondary" aria-hidden />
              {t("room.lobbyTitle", { game: getGameName(game, locale) })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {playerCountLabel}
              {" · "}
              {readyCountLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {allReady ? t("room.allReady") : t("room.waitingForPlayers")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("clickFrenzy.lobbyHint")}</p>
            <ul className="mt-4 space-y-2 text-sm" aria-label={t("room.playersList")}>
              {players.map((player) => {
                const playerReady = player.is_ready === true;
                return (
                  <li
                    key={player.id}
                    className={`flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 ${
                      playerReady ? "bg-success/10 ring-1 ring-success/30" : "bg-surface"
                    }`}
                  >
                    <span>
                      {roomPlayerLabel(player)}
                      {isLocalHost(player.id, players, hostUserId)
                        ? ` (${t("common.host")})`
                        : ""}
                    </span>
                    <span
                      className={
                        playerReady
                          ? "inline-flex items-center gap-1 font-medium text-success"
                          : "text-muted-foreground"
                      }
                    >
                      {playerReady && <Check className="size-3.5" aria-hidden />}
                      {playerReady ? t("common.ready") : t("common.waiting")}
                    </span>
                  </li>
                );
              })}
              {players.length === 0 && (
                <li className="text-muted-foreground">{t("common.loading")}</li>
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant={isReady ? "outline" : "secondary"}
              className="flex-1"
              disabled={loading}
              onClick={() => void toggleReady()}
            >
              {isReady ? t("room.cancelReady") : t("room.markReady")}
            </Button>
            {isHost && (
              <Button
                className="flex-1"
                disabled={!canStart}
                onClick={() => void startGame()}
              >
                <Play className="size-4" aria-hidden />
                {t("room.startGame")}
              </Button>
            )}
          </div>
        </>
      )}

      <Button variant="link" asChild className="w-full">
        <Link href={`/games/${CLICK_FRENZY_SLUG}`}>{t("room.backToGame")}</Link>
      </Button>
    </div>
  );
}
