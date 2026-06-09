import { STATIC_GAMES } from "@/lib/games/catalog";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Resolve slug a partir de um id estático do catálogo (ex.: g1 → memoria-classica). */
export function resolveSlugFromGameId(gameId: string): string | undefined {
  if (isUuid(gameId)) return undefined;
  return STATIC_GAMES.find((game) => game.id === gameId)?.slug;
}
