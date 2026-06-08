import { toast } from "sonner";
import type { UnlockedAchievement } from "@/types/platform";

export function showAchievementUnlockedToasts(
  achievements: UnlockedAchievement[],
  labels: { title: string }
) {
  for (const achievement of achievements) {
    toast.success(labels.title, {
      description: achievement.name,
      duration: 6000,
    });
  }
}
