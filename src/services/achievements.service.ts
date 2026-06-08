import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { parseUnlockedAchievements } from "@/lib/achievements/parse-unlocked";
import type { Achievement, UnlockedAchievement } from "@/types/platform";

function mapAchievementRow(row: Record<string, unknown>): Achievement {
  return {
    id: String(row.id),
    slug: String(row.slug ?? row.code ?? ""),
    name: String(row.name),
    description: String(row.description ?? ""),
    icon: (row.icon ?? row.icon_url ?? null) as string | null,
    category: row.category as Achievement["category"],
    metric: row.metric ? String(row.metric) : undefined,
    target_value:
      row.target_value != null ? Number(row.target_value) : undefined,
    points: row.points != null ? Number(row.points) : undefined,
    hidden: Boolean(row.hidden),
  };
}

function isPlatformAchievement(row: Record<string, unknown>): boolean {
  const category = row.category as string | null | undefined;
  if (category === "platform") return true;
  if (category && category !== "platform") return false;
  return row.metric != null && row.target_value != null;
}

async function fetchAchievementCatalog(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: byCategory, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("category", "platform")
    .order("target_value", { ascending: true });

  if (error) {
    console.warn("[getAchievementsForUser] catalog by category failed:", error.message);
  }

  if (!error && (byCategory?.length ?? 0) > 0) {
    return byCategory ?? [];
  }

  const { data: all, error: allError } = await supabase
    .from("achievements")
    .select("*")
    .order("target_value", { ascending: true });

  if (allError) {
    console.warn("[getAchievementsForUser] catalog fallback failed:", allError.message);
    return [];
  }

  return (all ?? []).filter((row) =>
    isPlatformAchievement(row as Record<string, unknown>)
  );
}

type UnlockInfo = { unlocked_at: string; is_featured: boolean };

async function fetchUserUnlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Map<string, UnlockInfo>> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at, is_featured")
    .eq("user_id", userId);

  if (!error) {
    return new Map(
      (data ?? []).map((row) => [
        row.achievement_id as string,
        {
          unlocked_at: row.unlocked_at as string,
          is_featured: Boolean(row.is_featured),
        },
      ])
    );
  }

  console.warn("[getAchievementsForUser] unlocks select failed:", error.message);

  // is_featured pode não existir em BDs antigas — tenta sem essa coluna.
  const { data: basic, error: basicError } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .eq("user_id", userId);

  if (basicError) {
    console.warn("[getAchievementsForUser] unlocks fallback failed:", basicError.message);
    return new Map<string, UnlockInfo>();
  }

  return new Map(
    (basic ?? []).map((row) => [
      row.achievement_id as string,
      { unlocked_at: row.unlocked_at as string, is_featured: false },
    ])
  );
}

export async function getAchievementsForUser(
  userId?: string
): Promise<Achievement[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const catalogRows = await fetchAchievementCatalog(supabase);
  const catalog = catalogRows.map((row) =>
    mapAchievementRow(row as Record<string, unknown>)
  );

  if (!userId) {
    return catalog.filter((a) => !a.hidden);
  }

  const unlockedMap = await fetchUserUnlocks(supabase, userId);

  const catalogIds = new Set(catalog.map((a) => a.id));
  const missingIds = [...unlockedMap.keys()].filter((id) => !catalogIds.has(id));

  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from("achievements")
      .select("*")
      .in("id", missingIds);

    for (const row of extra ?? []) {
      catalog.push(mapAchievementRow(row as Record<string, unknown>));
    }
  }

  return catalog
    .filter((a) => !a.hidden || unlockedMap.has(a.id))
    .map((a) => {
      const info = unlockedMap.get(a.id);
      return {
        ...a,
        unlocked_at: info?.unlocked_at,
        is_featured: info?.is_featured ?? false,
      };
    })
    .sort((a, b) => (a.target_value ?? 0) - (b.target_value ?? 0));
}

export async function evaluatePlatformAchievements(
  userId: string
): Promise<UnlockedAchievement[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("evaluate_platform_achievements", {
    p_user_id: userId,
  });

  if (error) {
    console.warn(
      "[evaluatePlatformAchievements] RPC failed:",
      error.message
    );
    return [];
  }

  return parseUnlockedAchievements(data);
}

async function findAchievementIdBySlug(slug: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: bySlug } = await supabase
    .from("achievements")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (bySlug?.id) return bySlug.id;

  const { data: byCode } = await supabase
    .from("achievements")
    .select("id")
    .eq("code", slug)
    .maybeSingle();

  return byCode?.id ?? null;
}

/** Manual unlock — prefer evaluatePlatformAchievements after sessions. */
export async function unlockAchievement(userId: string, slug: string) {
  if (!isSupabaseConfigured()) return;

  const achievementId = await findAchievementIdBySlug(slug);
  if (!achievementId) return;

  const supabase = await createClient();
  const now = new Date().toISOString();

  await supabase.from("user_achievements").upsert(
    {
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: now,
    },
    { onConflict: "user_id,achievement_id", ignoreDuplicates: true }
  );
}
