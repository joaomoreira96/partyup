import type { Profile } from "@/types/platform";

type BanFields = Pick<Profile, "is_banned" | "banned_until" | "ban_reason">;

export function isBanActive(profile: BanFields, now = new Date()): boolean {
  if (!profile.is_banned) return false;
  if (!profile.banned_until) return true;
  return new Date(profile.banned_until) > now;
}

export function isBanExpired(profile: BanFields, now = new Date()): boolean {
  return Boolean(
    profile.is_banned && profile.banned_until && new Date(profile.banned_until) <= now
  );
}

export function formatBanUntil(until: string | null | undefined, locale: string): string | null {
  if (!until) return null;
  return new Date(until).toLocaleString(locale === "pt" ? "pt-PT" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
