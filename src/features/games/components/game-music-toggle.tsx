"use client";

import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/locale-provider";

interface GameMusicToggleProps {
  muted: boolean;
  onToggle: () => void;
}

export function GameMusicToggle({ muted, onToggle }: GameMusicToggleProps) {
  const { t } = useI18n();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="absolute right-3 top-3 z-20 bg-card/90 backdrop-blur-sm"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? t("games.play.musicUnmute") : t("games.play.musicMute")}
      title={muted ? t("games.play.musicUnmute") : t("games.play.musicMute")}
    >
      {muted ? (
        <VolumeX className="size-4" aria-hidden />
      ) : (
        <Volume2 className="size-4" aria-hidden />
      )}
    </Button>
  );
}
