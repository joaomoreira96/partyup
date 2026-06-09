import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isBanActive } from "@/lib/auth/ban";
import { logSecurityEvent } from "@/services/security-event.service";
import type { Profile } from "@/types/platform";

export async function isUserBanned(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_user_banned", {
    p_user_id: userId,
  });

  if (!error && typeof data === "boolean") return data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, banned_until")
    .eq("id", userId)
    .maybeSingle();

  return profile ? isBanActive(profile as Pick<Profile, "is_banned" | "banned_until">) : false;
}

export async function assertNotBanned(
  userId: string,
  action: string,
  ip?: string | null
): Promise<{ banned: false } | { banned: true; message: string }> {
  const banned = await isUserBanned(userId);
  if (!banned) return { banned: false };

  await logSecurityEvent({
    eventType: "BANNED_ACCESS",
    severity: "high",
    userId,
    ipAddress: ip ?? undefined,
    metadata: { action },
  });

  return {
    banned: true,
    message: "A tua conta está suspensa. Contacta o suporte se achas que é um erro.",
  };
}
