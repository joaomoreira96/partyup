"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Play, Share2, Users } from "lucide-react";
import { useRoom } from "@/hooks/use-room";
import { getGuestName, setGuestName } from "@/lib/guest";
import { useI18n } from "@/features/i18n/locale-provider";
import type { GameRecord } from "@/types/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function RoomLobby({
  code,
  game,
  isHost,
  offline,
}: {
  code: string;
  game: GameRecord;
  isHost?: boolean;
  offline?: boolean;
}) {
  const { t } = useI18n();
  const [guestName, setGuestNameState] = useState(() => t("common.guest"));
  const [ready, setReady] = useState(false);
  const { join, ready: markReady, start, error } = useRoom(code);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/rooms/${code}`
      : `/rooms/${code}`;

  useEffect(() => {
    setGuestNameState(getGuestName());
    void join();
  }, [join]);

  async function toggleReady() {
    const result = await markReady();
    if (result.ok) setReady(true);
    else toast.error(t("room.loginToReady"));
  }

  async function startGame() {
    const result = await start();
    if (result.ok) {
      window.location.href = `/games/${game.slug}/play?room=${code}`;
    } else {
      toast.error(t("room.hostOnly"));
    }
  }

  function copyLink() {
    void navigator.clipboard.writeText(joinUrl);
    toast.success(t("room.linkCopied"));
  }

  return (
    <div className="space-y-6">
      <div className="party-card-premium border-secondary/20 bg-gradient-to-br from-secondary/10 to-transparent p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("room.roomCodeLabel")}</p>
        <p
          className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-primary sm:text-4xl"
          aria-label={`${t("room.roomCodeLabel")} ${code}`}
        >
          {code}
        </p>
        {offline && (
          <p
            className="mt-3 flex items-center justify-center gap-2 text-xs text-warning"
            role="status"
          >
            {t("room.offlineHint")}
          </p>
        )}
      </div>

      {error && (
        <p
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="party-card space-y-2 p-4">
        <Label htmlFor="guest-lobby-name">{t("room.yourName")}</Label>
        <Input
          id="guest-lobby-name"
          value={guestName}
          onChange={(e) => setGuestNameState(e.target.value)}
          onBlur={() => setGuestName(guestName)}
        />
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
          {t("room.lobbyTitle", { game: game.name })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("room.lobbyHint")}</p>
        <ul className="mt-4 space-y-2 text-sm" aria-label={t("room.playersList")}>
          <li className="flex items-center justify-between rounded-[var(--radius-md)] bg-surface px-3 py-2.5">
            <span>
              {guestName} {isHost ? t("common.host") : ""}
            </span>
            <span
              className={
                ready ? "font-medium text-success" : "text-muted-foreground"
              }
            >
              {ready ? t("common.ready") : t("common.waiting")}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" className="flex-1" onClick={() => void toggleReady()}>
          {t("room.markReady")}
        </Button>
        <Button className="flex-1" onClick={() => void startGame()}>
          <Play className="size-4" aria-hidden />
          {t("room.startGame")}
        </Button>
      </div>

      <Button variant="link" asChild className="w-full">
        <Link href={`/games/${game.slug}`}>{t("room.backToGame")}</Link>
      </Button>
    </div>
  );
}
