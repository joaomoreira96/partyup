"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScoreReviewRow } from "@/services/admin-security.service";

export function ScoreReviewManager() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ScoreReviewRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/score-reviews");
      if (!res.ok) throw new Error("fetch_failed");
      const data = (await res.json()) as { reviews: ScoreReviewRow[] };
      setReviews(data.reviews ?? []);
    } catch {
      toast.error("Não foi possível carregar revisões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    leaderboardId: string,
    action: "approve" | "reject" | "ban" | "flag",
    userId: string,
    reason?: string
  ) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/score-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboardId, action, userId, reason }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Ação falhou.");
        return;
      }
      toast.success("Atualizado.");
      await load();
    } catch {
      toast.error("Ação falhou.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        A carregar…
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Score Reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pontuações suspeitas ou rejeitadas aguardam revisão.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={saving}>
          Atualizar
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {reviews.length === 0 ? (
          <li className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            Sem pontuações pendentes.
          </li>
        ) : (
          reviews.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {row.displayName || row.username || row.userId}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {row.gameName ?? row.gameSlug}
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  Score: <strong>{row.score}</strong>
                  {row.reviewReason ? (
                    <span className="ml-2 text-muted-foreground">— {row.reviewReason}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.achievedAt).toLocaleString("pt-PT")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.status === "pending_review" ? "secondary" : "destructive"}>
                  {row.status}
                </Badge>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void act(row.id, "approve", row.userId)}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void act(row.id, "reject", row.userId, row.reviewReason ?? undefined)}
                >
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void act(row.id, "flag", row.userId, "SCORE_ABUSE")}
                >
                  Flag
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void act(row.id, "ban", row.userId, "Score abuse")}
                >
                  Banir
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
