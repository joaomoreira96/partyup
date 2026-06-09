/** IDs de módulos jogáveis — lista partilhada sem importar os bundles dos jogos. */
export const GAME_MODULE_IDS = [
  "memory",
  "reaction",
  "trivia",
  "snake",
  "reaction-duel",
  "click-frenzy",
] as const;

export type GameModuleId = (typeof GAME_MODULE_IDS)[number];

const REGISTERED = new Set<string>(GAME_MODULE_IDS);

export function isRegisteredModuleId(value: string | undefined | null): value is string {
  const id = value?.trim();
  return Boolean(id && id !== "local" && REGISTERED.has(id));
}
