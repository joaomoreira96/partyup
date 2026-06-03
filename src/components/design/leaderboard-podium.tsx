import Link from "next/link";
import { Medal, Trophy } from "lucide-react";
import { formatScoreForMetric } from "@/lib/games/types";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types/platform";
import { cn } from "@/lib/utils";

const PODIUM = [
  { place: 2, height: "h-20", ring: "ring-slate-400/50", bg: "bg-surface" },
  { place: 1, height: "h-28", ring: "ring-accent/60", bg: "bg-accent/10" },
  { place: 3, height: "h-16", ring: "ring-amber-700/40", bg: "bg-surface" },
] as const;

function PlayerName({ entry }: { entry: LeaderboardEntry }) {
  const name = entry.profile?.display_name ?? entry.profile?.username ?? "Jogador";
  if (entry.profile?.username) {
    return (
      <Link
        href={`/players/${entry.profile.username}`}
        className="truncate font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {name}
      </Link>
    );
  }
  return <span className="truncate font-medium">{name}</span>;
}

export function LeaderboardPodium({
  entries,
  metric,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
}) {
  if (entries.length < 1) return null;

  const ordered = [
    entries[1],
    entries[0],
    entries[2],
  ].filter((e): e is LeaderboardEntry => e != null);

  return (
    <div
      className="mb-8 grid grid-cols-3 items-end gap-3 sm:gap-4"
      role="list"
      aria-label="Top 3"
    >
      {PODIUM.map((slot, i) => {
        const entry = ordered[i];
        if (!entry) {
          return <div key={slot.place} className="min-h-[4rem]" aria-hidden />;
        }
        const isFirst = slot.place === 1;
        return (
          <div
            key={entry.id}
            role="listitem"
            className={cn(
              "flex flex-col items-center rounded-[var(--radius-premium)] border p-3 text-center transition-transform duration-200 motion-reduce:transition-none",
              slot.bg,
              slot.ring,
              "ring-2",
              isFirst && "scale-[1.02] sm:scale-105"
            )}
          >
            <div
              className={cn(
                "mb-2 flex w-full items-center justify-center rounded-lg",
                slot.height
              )}
            >
              {isFirst ? (
                <Trophy className="size-8 text-accent" aria-hidden />
              ) : (
                <Medal
                  className={cn(
                    "size-7",
                    slot.place === 2 ? "text-slate-300" : "text-amber-600"
                  )}
                  aria-hidden
                />
              )}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {slot.place}º lugar
            </span>
            <div className="mt-1 w-full">
              <PlayerName entry={entry} />
            </div>
            <p className="mt-2 font-mono text-sm font-bold tabular-nums text-primary">
              {formatScoreForMetric(entry.score, metric)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
