import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isAdmin } from "@/services/auth.service";
import type { AdminUserRow } from "@/types/platform";

export async function listUsersForAdmin(
  query?: string,
  limit = 50
): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  let request = supabase
    .from("profiles")
    .select(
      "id, username, display_name, role, is_banned, banned_until, ban_reason, created_at"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const term = query?.trim();
  if (term) {
    const pattern = `%${term}%`;
    request = request.or(
      `username.ilike.${pattern},display_name.ilike.${pattern}`
    );
  }

  const { data, error } = await request;
  if (error) return [];
  return (data ?? []) as AdminUserRow[];
}

export type BanUpdateInput = {
  is_banned: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
};

function mapBanRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("forbidden") || lower.includes("42501")) return "forbidden";
  if (lower.includes("user_not_found") || lower.includes("p0002")) {
    return "user_not_found";
  }
  if (lower.includes("cannot_ban_admin") || lower.includes("p0001")) {
    return "cannot_ban_admin";
  }
  return "unknown";
}

export async function updateUserBan(
  userId: string,
  input: BanUpdateInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_user_ban", {
    target_user_id: userId,
    banned: input.is_banned,
    until: input.is_banned ? (input.banned_until ?? null) : null,
    reason: input.is_banned ? (input.ban_reason?.trim() || null) : null,
  });

  if (error) {
    const mapped = mapBanRpcError(error.message);
    return { ok: false, error: mapped === "unknown" ? error.message : mapped };
  }

  if (!data) return { ok: false, error: "user_not_found" };
  return { ok: true };
}
