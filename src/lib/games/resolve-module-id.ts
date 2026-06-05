import type { GameBuild, GameRecord } from "@/types/platform";

/** Resolve o module_id quando a coluna não existe na tabela games (schema hosted). */
export function resolveGameModuleId(
  game: Pick<GameRecord, "slug" | "module_id"> & {
    active_build?: GameBuild | null;
  }
): string {
  const fromColumn = game.module_id?.trim();
  if (fromColumn) return fromColumn;

  const fromBuild = game.active_build?.build_url?.trim();
  if (fromBuild && fromBuild !== "local") return fromBuild;

  return game.slug;
}
