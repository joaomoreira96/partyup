"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { getGuestName } from "@/lib/guest";
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
  const [loading, setLoading] = useState(false);

  if (!supportsMultiplayer) return null;

  async function createRoom() {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameSlug, guestName: getGuestName() }),
      });
      const data = await res.json();
      if (data.joinUrl) router.push(data.joinUrl);
      else toast.error("Não foi possível criar a sala.");
    } catch {
      toast.error("Ligação indisponível.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={() => void createRoom()}
      disabled={loading}
      aria-busy={loading}
    >
      <Users className="size-4" aria-hidden />
      {loading ? "A criar..." : "Criar sala"}
    </Button>
  );
}
