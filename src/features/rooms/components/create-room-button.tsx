"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { getGuestName } from "@/lib/guest";
import { saveRoomPlayerId } from "@/lib/rooms/player-session";
import { useI18n } from "@/features/i18n/locale-provider";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CreateRoomButton({
  gameSlug,
  supportsMultiplayer,
}: {
  gameSlug: string;
  supportsMultiplayer: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(false);

  if (!supportsMultiplayer) return null;

  async function createRoom() {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(`/games/${gameSlug}`)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameSlug, guestName: getGuestName() }),
      });
      const data = (await res.json()) as {
        joinUrl?: string;
        code?: string;
        playerId?: string;
        error?: string;
        detail?: string;
      };
      if (data.playerId && data.code) {
        saveRoomPlayerId(data.code, data.playerId);
      }
      if (data.joinUrl) router.push(data.joinUrl);
      else {
        const hint =
          data.detail && data.detail !== data.error ? ` (${data.detail})` : "";
        toast.error(`${data.error ?? t("room.createFailed")}${hint}`);
      }
    } catch {
      toast.error(t("room.offline"));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <Button variant="secondary" disabled aria-busy>
        <Users className="size-4" aria-hidden />
        {t("common.loading")}
      </Button>
    );
  }

  if (!user) {
    return (
      <Button variant="secondary" asChild>
        <Link href={`/auth/login?next=${encodeURIComponent(`/games/${gameSlug}`)}`}>
          <Users className="size-4" aria-hidden />
          {t("room.createRoom")}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={() => void createRoom()}
      disabled={loading}
      aria-busy={loading}
    >
      <Users className="size-4" aria-hidden />
      {loading ? t("common.creating") : t("room.createRoom")}
    </Button>
  );
}
