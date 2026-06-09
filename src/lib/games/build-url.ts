/** URL pública de um objecto no bucket game-builds (client + server safe). */
export function getGameBuildsPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const normalized = storagePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/game-builds/${normalized}`;
}

/** Origem permitida para postMessage de um build iframe. */
export function getBuildOrigin(buildPublicUrl: string): string | null {
  try {
    return new URL(buildPublicUrl).origin;
  } catch {
    return null;
  }
}
