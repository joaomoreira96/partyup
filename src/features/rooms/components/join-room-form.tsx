"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeRoomCode } from "@/lib/rooms/codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinRoomForm({ gameSlug }: { gameSlug?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) return;
    const query = gameSlug ? `?game=${encodeURIComponent(gameSlug)}` : "";
    router.push(`/rooms/${normalized}${query}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="room-code">Entrar por código</Label>
        <Input
          id="room-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          className="font-mono uppercase tracking-widest"
        />
      </div>
      <Button type="submit" variant="outline">
        Entrar na sala
      </Button>
    </form>
  );
}
