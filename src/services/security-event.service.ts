import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export type SecurityEventType =
  | "LOGIN_FAILED"
  | "RATE_LIMIT_HIT"
  | "ROOM_SPAM"
  | "ROOM_CREATE_DENIED"
  | "SCORE_REJECTED"
  | "SUSPICIOUS_SCORE"
  | "INVALID_SCORE"
  | "ADMIN_ACCESS_DENIED"
  | "BANNED_ACCESS"
  | "SUSPICIOUS_ACTIVITY"
  | "BAN_CREATED"
  | "BAN_REMOVED"
  | "BAN_EXPIRED"
  | "FLAG_CREATED"
  | "FLAG_RESOLVED"
  | "SCORE_APPROVED"
  | "SCORE_REJECTED_ADMIN";

export async function logSecurityEvent(params: {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  userId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase.rpc("log_security_event", {
    p_event_type: params.eventType,
    p_severity: params.severity ?? "low",
    p_user_id: params.userId ?? null,
    p_ip_address: params.ipAddress ?? null,
    p_metadata: params.metadata ?? {},
  });
}
