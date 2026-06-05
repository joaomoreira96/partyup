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

  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    user.email?.split("@")[0] ||
    "Jogador";
  const username =
    typeof meta.username === "string" && meta.username.trim()
      ? meta.username.trim()
      : null;

  if (existing) {
    const updates: {
      display_name?: string;
      username?: string | null;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.display_name?.trim()) {
      updates.display_name = displayName;
    }
    if (profile && !profile.username?.trim() && username) {
      updates.username = username;
    }

    if (updates.display_name || updates.username) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        return { ok: false as const, error: error.message, code: error.code };
      }
    }

    return { ok: true as const };
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
    username,
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
