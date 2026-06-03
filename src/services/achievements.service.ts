import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Achievement } from "@/types/platform";

const STATIC_ACHIEVEMENTS: Achievement[] = [
  {
    id: "a1",
    slug: "first_win",
    name: "Primeira vitória",
    description: "Completa o teu primeiro jogo com sucesso.",
    icon: "trophy",
  },
  {
    id: "a2",
    slug: "games_100",
    name: "Veterano",
    description: "Joga 100 partidas na plataforma.",
    icon: "star",
  },
  {
    id: "a3",
    slug: "top_10",
    name: "Top 10",
    description: "Alcança o top 10 num ranking oficial.",
    icon: "medal",
  },
  {
    id: "a4",
    slug: "invite_friend",
    name: "Anfitrião",
    description: "Cria uma sala e recebe um amigo no lobby.",
    icon: "users",
  },
];

export async function getAchievementsForUser(
  userId?: string
): Promise<Achievement[]> {
  if (!isSupabaseConfigured()) {
    return STATIC_ACHIEVEMENTS.map((a) => ({ ...a, unlocked_at: undefined }));
  }

  const supabase = await createClient();
  const { data: all } = await supabase.from("achievements").select("*").order("name");

  if (!userId) return (all ?? []) as Achievement[];

  const { data: unlocked } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .eq("user_id", userId);

  const unlockedMap = new Map(
    (unlocked ?? []).map((u) => [u.achievement_id, u.unlocked_at])
  );

  return ((all ?? []) as Achievement[]).map((a) => ({
    ...a,
    unlocked_at: unlockedMap.get(a.id),
  }));
}

export async function unlockAchievement(userId: string, slug: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: achievement } = await supabase
    .from("achievements")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!achievement) return;

  await supabase.from("user_achievements").upsert(
    { user_id: userId, achievement_id: achievement.id },
    { onConflict: "user_id,achievement_id", ignoreDuplicates: true }
  );
}

export async function checkPostGameAchievements(
  userId: string,
  opts: { gamesPlayed: number; isFirstComplete?: boolean }
) {
  if (opts.isFirstComplete) await unlockAchievement(userId, "first_win");
  if (opts.gamesPlayed >= 100) await unlockAchievement(userId, "games_100");
}
