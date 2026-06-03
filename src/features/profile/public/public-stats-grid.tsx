import { Clock, Gamepad2, Star, Trophy } from "lucide-react";
import { formatPlayTimeHours } from "@/services/public-profile.service";
import type { UserStats } from "@/types/platform";

export function PublicStatsGrid({
  stats,
  achievementCount,
}: {
  stats: UserStats;
  achievementCount: number;
}) {
  const items = [
    {
      label: "Jogos jogados",
      value: stats.total_games_played.toLocaleString("pt-PT"),
      icon: Gamepad2,
    },
    {
      label: "Tempo total",
      value: formatPlayTimeHours(stats.total_play_time_seconds),
      icon: Clock,
    },
    {
      label: "Pontuação total",
      value: Math.round(stats.total_score).toLocaleString("pt-PT"),
      icon: Star,
    },
    {
      label: "Conquistas",
      value: achievementCount.toLocaleString("pt-PT"),
      icon: Trophy,
    },
  ];

  return (
    <section aria-labelledby="public-stats-heading">
      <h2 id="public-stats-heading" className="sr-only">
        Estatísticas gerais
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="party-card flex flex-col gap-2 p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </dt>
            <dd className="text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
