import type { GameModule, GameModuleRegistration } from "@/lib/games/types";

const registrations: GameModuleRegistration[] = [
  {
    id: "memory",
    loader: () => import("@/games/memory"),
  },
  {
    id: "reaction",
    loader: () => import("@/games/reaction"),
  },
  {
    id: "trivia",
    loader: () => import("@/games/trivia"),
  },
];

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
