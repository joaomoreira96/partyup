import { GAME_MODULE_IDS } from "@/lib/games/module-ids";
import type { GameModule, GameModuleRegistration } from "@/lib/games/types";

const loaders: Record<
  (typeof GAME_MODULE_IDS)[number],
  () => Promise<{ default: GameModule }>
> = {
  memory: () => import("@/games/memory"),
  reaction: () => import("@/games/reaction"),
  trivia: () => import("@/games/trivia"),
  snake: () => import("@/games/snake"),
  "reaction-duel": () => import("@/games/reaction-duel"),
  "click-frenzy": () => import("@/games/click-frenzy"),
};

const registrations: GameModuleRegistration[] = GAME_MODULE_IDS.map((id) => ({
  id,
  loader: loaders[id],
}));

const cache = new Map<string, GameModule>();

export function getRegisteredModuleIds(): string[] {
  return registrations.map((r) => r.id);
}

export async function loadGameModule(moduleId: string): Promise<GameModule | null> {
  if (cache.has(moduleId)) {
    return cache.get(moduleId)!;
  }

  const registration = registrations.find((r) => r.id === moduleId);
  if (!registration) return null;

  const mod = await registration.loader();
  cache.set(moduleId, mod.default);
  return mod.default;
}

export function registerGameModule(registration: GameModuleRegistration) {
  const existing = registrations.findIndex((r) => r.id === registration.id);
  if (existing >= 0) {
    registrations[existing] = registration;
  } else {
    registrations.push(registration);
  }
  cache.delete(registration.id);
}
