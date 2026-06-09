"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SecurityOverview } from "@/services/admin-security.service";

type FlagRow = {
  id: string;
  userId: string;
  reason: string;
  severity: string;
  createdAt: string;
  displayName: string | null;
  username: string | null;
};

type SecurityEvent = {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  created_at: string;
};

export function SecurityOverviewPanel() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security");
      if (!res.ok) throw new Error("fetch_failed");
      const data = (await res.json()) as {
        overview: SecurityOverview;
        flags: FlagRow[];
        recentEvents: SecurityEvent[];
      };
      setOverview(data.overview);
      setFlags(data.flags ?? []);
      setEvents(data.recentEvents ?? []);
    } catch {
      toast.error("Não foi possível carregar dados de segurança.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveFlag(flagId: string) {
    const res = await fetch("/api/admin/security/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagId }),
    });
    if (!res.ok) {
      toast.error("Não foi possível resolver a flag.");
      return;
    }
    toast.success("Flag resolvida.");
    await load();
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        A carregar…
      </div>
    );
  }

  const cards = [
    { label: "Eventos (24h)", value: overview?.eventsLast24h ?? 0 },
    { label: "Rate limits (24h)", value: overview?.rateLimitsLast24h ?? 0 },
    { label: "Scores rejeitados (24h)", value: overview?.rejectedScoresLast24h ?? 0 },
    { label: "Scores pendentes", value: overview?.pendingReviews ?? 0 },
    { label: "Users sinalizados", value: overview?.flaggedUsers ?? 0 },
    { label: "Bans ativos", value: overview?.activeBans ?? 0 },
    { label: "Bans removidos (24h)", value: overview?.recentRevocations ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Flags ativas</h3>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {flags.length === 0 ? (
            <li className="rounded-lg border px-4 py-4 text-sm text-muted-foreground">
              Sem flags pendentes.
            </li>
          ) : (
            flags.map((flag) => (
              <li
                key={flag.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {flag.displayName || flag.username || flag.userId}
                  </p>
                  <p className="text-sm text-muted-foreground">{flag.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{flag.severity}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => void resolveFlag(flag.id)}>
                    Resolver
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">Eventos recentes (24h)</h3>
        <ul className="mt-3 space-y-2">
          {events.length === 0 ? (
            <li className="rounded-lg border px-4 py-4 text-sm text-muted-foreground">
              Sem eventos recentes.
            </li>
          ) : (
            events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-muted-foreground" aria-hidden />
                  {event.event_type}
                </span>
                <span className="text-muted-foreground">
                  <Badge variant="outline" className="mr-2">
                    {event.severity}
                  </Badge>
                  {new Date(event.created_at).toLocaleString("pt-PT")}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
