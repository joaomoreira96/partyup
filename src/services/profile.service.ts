import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Profile } from "@/types/platform";

export async function updateProfile(
  userId: string,
  updates: Partial<
    Pick<Profile, "display_name" | "username" | "avatar_url" | "bio" | "country">
  >
) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "offline" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .is("deleted_at", null);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function softDeleteProfile(userId: string) {
  if (!isSupabaseConfigured()) return { ok: false as const };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export {
  getProfile,
  getProfileByUsername,
  getCurrentProfile,
} from "@/services/auth.service";
