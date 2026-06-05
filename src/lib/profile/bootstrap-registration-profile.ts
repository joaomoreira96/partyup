import { createClient } from "@/lib/supabase/client";
import { mapProfileSaveError } from "@/lib/profile/errors";

type BootstrapInput = {
  display_name: string;
  username: string;
};

/** Garante que o perfil criado no registo tem nome e tag guardados na BD. */
export async function bootstrapRegistrationProfile(
  input: BootstrapInput
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
    .select("id, display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: input.display_name,
      username: input.username,
    });

    if (error) {
      return { ok: false, message: mapProfileSaveError(error.message, error.code) };
    }

    await supabase
      .from("user_stats")
      .upsert({ user_id: user.id }, { onConflict: "user_id" });

    await supabase.auth.updateUser({
      data: {
        display_name: input.display_name,
        username: input.username,
      },
    });

    return { ok: true };
  }

  const updates: { display_name?: string; username?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (!existing.display_name?.trim()) {
    updates.display_name = input.display_name;
  }
  if (!existing.username?.trim()) {
    updates.username = input.username;
  }

  if (updates.display_name || updates.username) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return { ok: false, message: mapProfileSaveError(error.message, error.code) };
    }

    await supabase.auth.updateUser({
      data: {
        display_name: updates.display_name ?? input.display_name,
        username: updates.username ?? input.username,
      },
    });
  }

  return { ok: true };
}
