import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { mapProfileSaveError } from "@/lib/profile/errors";
import type { Profile } from "@/types/platform";
import type { User } from "@supabase/supabase-js";

export { mapProfileSaveError } from "@/lib/profile/errors";

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  let query = supabase.from("profiles").select("id").eq("username", username);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return !data;
}

/** Cria linha em profiles se o trigger de registo não correu. */
export async function ensureProfileForUser(user: User) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "offline" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return { ok: true as const };

  const meta = user.user_metadata ?? {};
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name:
      (typeof meta.display_name === "string" && meta.display_name) ||
      user.email?.split("@")[0] ||
      "Jogador",
    username:
      typeof meta.username === "string" ? meta.username : null,
  });

  if (error) {
    return { ok: false as const, error: error.message, code: error.code };
  }

  return { ok: true as const };
}

export async function updateProfile(
  userId: string,
  updates: Partial<
    Pick<
      Profile,
      | "display_name"
      | "username"
      | "avatar_url"
      | "bio"
      | "country"
      | "public_profile"
      | "show_activity"
      | "show_country"
    >
  >
) {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: "offline" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, code: error.code };
  }
  if (!data) {
    return { ok: false as const, error: "profile_not_found" };
  }
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
