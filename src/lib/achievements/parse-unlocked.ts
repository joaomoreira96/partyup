import type { UnlockedAchievement } from "@/types/platform";

export function parseUnlockedAchievements(raw: unknown): UnlockedAchievement[] {
  if (!Array.isArray(raw)) return [];

  const results: UnlockedAchievement[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "");
    if (!name) continue;

    results.push({
      id: String(row.id ?? row.code ?? name),
      code: row.code ? String(row.code) : undefined,
      name,
      description: String(row.description ?? ""),
      icon: (row.icon as string | null) ?? "trophy",
      points: Number(row.points ?? 0),
    });
  }

  return results;
}
