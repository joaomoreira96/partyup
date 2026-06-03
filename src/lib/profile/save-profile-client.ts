import { createClient } from "@/lib/supabase/client";
import { mapProfileSaveError } from "@/lib/profile/errors";
import type { Profile } from "@/types/platform";

export type ProfileSaveInput = {
  display_name?: string;
  username?: string;
  avatar_url?: string | null;
  bio?: string | null;
  country?: string | null;
  public_profile?: boolean;
  show_activity?: boolean;
  show_country?: boolean;
};

export async function saveProfileClient(
  input: ProfileSaveInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Entra novamente." };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const payload: Partial<Profile> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (input.display_name !== undefined) {
    payload.display_name = input.display_name;
  }
  if (input.username !== undefined) {
    payload.username = input.username;
  }
  if (input.avatar_url !== undefined) {
    payload.avatar_url = input.avatar_url;
  }
  if (input.bio !== undefined) {
    payload.bio = input.bio;
  }
  if (input.country !== undefined) {
    payload.country = input.country;
  }
  if (input.public_profile !== undefined) {
    payload.public_profile = input.public_profile;
  }
  if (input.show_activity !== undefined) {
    payload.show_activity = input.show_activity;
  }
  if (input.show_country !== undefined) {
    payload.show_country = input.show_country;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, message: mapProfileSaveError(error.message, error.code) };
    }
    if (!data) {
      return {
        ok: false,
        message:
          "Não foi possível atualizar o perfil. Verifica as políticas RLS no Supabase.",
      };
    }
  } else {
    const meta = user.user_metadata ?? {};
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      display_name:
        input.display_name ||
        (typeof meta.display_name === "string" ? meta.display_name : null) ||
        user.email?.split("@")[0] ||
        "Jogador",
      username: input.username ?? null,
      avatar_url: input.avatar_url ?? null,
      bio: input.bio ?? null,
      updated_at: payload.updated_at,
    });

    if (error) {
      return { ok: false, message: mapProfileSaveError(error.message, error.code) };
    }

    await supabase
      .from("user_stats")
      .upsert({ user_id: user.id }, { onConflict: "user_id" });
  }

  if (input.display_name) {
    await supabase.auth.updateUser({
      data: { display_name: input.display_name },
    });
  }

  return { ok: true };
}

export async function isUsernameAvailableClient(
  username: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", userId)
    .maybeSingle();

  if (error) return false;
  return !data;
}
