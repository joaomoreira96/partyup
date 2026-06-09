"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameRunner } from "@/components/games/game-runner";
import { NativeGamePlayer } from "@/features/games/components/native-game-player";
import { getGuestName } from "@/lib/guest";
import type { GameRecord } from "@/types/platform";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const { t } = useI18n();
  const [guestName, setGuestNameState] = useState(() => t("common.guest"));
  const displayName = userDisplayName ?? guestName;
  const isIframe = game.runtime === "iframe";

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game-player.tsx:route',message:'GamePlayer route',data:{slug:game.slug,runtime:game.runtime,isIframe,activeBuildUrl:game.active_build?.build_url??null},timestamp:Date.now(),hypothesisId:'H-B-runtime'})}).catch(()=>{});
  }, [game.slug, game.runtime, isIframe, game.active_build?.build_url]);
  // #endregion

  useEffect(() => {
    if (isGuest) setGuestNameState(getGuestName());
  }, [isGuest]);

  if (!game.guest_allowed && isGuest) {
    return (
      <div className="party-card p-6 text-center">
        <p className="mb-4 text-muted-foreground">{t("games.play.requiresAccount")}</p>
        <Button asChild>
          <Link href="/register">{t("games.play.createAccount")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isGuest && (
        <div className="party-card flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="guest-name">{t("games.play.guestName")}</Label>
            <Input
              id="guest-name"
              defaultValue={guestName}
              onBlur={(e) => {
                const name = e.target.value || t("common.guest");
                localStorage.setItem("partyup_guest_name", name);
                setGuestNameState(name);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:max-w-xs">
            {t("games.play.guestHint")}
          </p>
        </div>
      )}

      {isIframe ? (
        <GameRunner
          game={game}
          userId={userId}
          userDisplayName={displayName}
          isGuest={isGuest}
          roomCode={roomCode}
        />
      ) : (
        <NativeGamePlayer
          game={game}
          userId={userId}
          userDisplayName={displayName}
          isGuest={isGuest}
          roomCode={roomCode}
        />
      )}
    </div>
  );
}
