import { getStaticGameBySlug } from "@/lib/games/catalog";
import { isRegisteredModuleId } from "@/lib/games/module-ids";
import type { GameBuild, GameRecord } from "@/types/platform";

/** Resolve o module_id quando a coluna não existe na tabela games (schema hosted). */
export function resolveGameModuleId(
  game: Pick<GameRecord, "slug" | "module_id"> & {
    active_build?: GameBuild | null;
  }
): string {
  const fromCatalog = getStaticGameBySlug(game.slug)?.module_id;

  const candidates = [
    game.module_id?.trim(),
    game.active_build?.build_url?.trim(),
    fromCatalog,
    game.slug,
  ];

  for (const candidate of candidates) {
    if (isRegisteredModuleId(candidate)) return candidate;
  }

  return fromCatalog ?? game.slug;
}
