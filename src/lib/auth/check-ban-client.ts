import { createClient } from "@/lib/supabase/client";
import { formatBanUntil, isBanActive } from "@/lib/auth/ban";
import type { Profile } from "@/types/platform";

type BanCheckResult =
  | { banned: false }
  | { banned: true; reason: string | null; until: string | null };

export async function checkActiveBanForUser(
  userId: string,
  locale: string
): Promise<BanCheckResult> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_banned, banned_until, ban_reason")
    .eq("id", userId)
    .maybeSingle();

  if (!data || !isBanActive(data as Pick<Profile, "is_banned" | "banned_until">)) {
    return { banned: false };
  }

  return {
    banned: true,
    reason: data.ban_reason ?? null,
    until: formatBanUntil(data.banned_until, locale),
  };
}

export async function signOutIfBanned(
  userId: string,
  locale: string
): Promise<BanCheckResult> {
  const ban = await checkActiveBanForUser(userId, locale);
  if (ban.banned) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
  return ban;
}
