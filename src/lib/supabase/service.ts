import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente Supabase com service role — apenas server-side (uploads game-builds). */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isServiceClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getGameBuildsPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const normalized = storagePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/game-builds/${normalized}`;
}
