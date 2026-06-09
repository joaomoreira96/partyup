import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { logSecurityEvent } from "@/services/security-event.service";

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
};

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!isSupabaseConfigured()) {
    return { allowed: true, count: 0, limit: config.limit };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket_key: config.key,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  });

  if (error || !data || typeof data !== "object") {
    return { allowed: true, count: 0, limit: config.limit };
  }

  const payload = data as { allowed?: boolean; count?: number; limit?: number };
  return {
    allowed: payload.allowed !== false,
    count: Number(payload.count ?? 0),
    limit: Number(payload.limit ?? config.limit),
  };
}

export async function enforceRateLimits(
  configs: RateLimitConfig[],
  context?: { userId?: string; ip?: string | null }
): Promise<RateLimitResult | null> {
  for (const config of configs) {
    const result = await checkRateLimit(config);
    if (!result.allowed) {
      if (context?.userId || context?.ip) {
        await logSecurityEvent({
          eventType: "RATE_LIMIT_HIT",
          severity: "medium",
          userId: context.userId,
          ipAddress: context.ip ?? undefined,
          metadata: { bucket: config.key, count: result.count, limit: result.limit },
        });
      }
      return result;
    }
  }
  return null;
}

export function rateLimitKey(
  action: string,
  userId?: string | null,
  ip?: string | null,
  windowSeconds?: number
): string {
  const base = userId
    ? `${action}:user:${userId}`
    : `${action}:ip:${ip ?? "unknown"}`;
  return windowSeconds ? `${base}:w${windowSeconds}` : base;
}

export const RATE_LIMITS = {
  roomCreate: [
    { limit: 5, windowSeconds: 60 },
    { limit: 20, windowSeconds: 3600 },
    { limit: 100, windowSeconds: 86400 },
  ],
  roomJoin: [{ limit: 30, windowSeconds: 60 }],
  scoreSubmit: [{ limit: 10, windowSeconds: 60 }],
} as const;
