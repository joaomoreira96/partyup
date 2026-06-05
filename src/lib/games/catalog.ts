import { isPlayableGame } from "@/lib/db/mappers";
import type { Category, DeviceCompatibility, GameRecord } from "@/types/platform";

/** Static catalog fallback when Supabase is unavailable (local dev). */
export const STATIC_CATEGORIES: Category[] = [
  { id: "1", slug: "puzzle", name: "Puzzle" },
  { id: "2", slug: "arcade", name: "Arcade" },
  { id: "3", slug: "memory", name: "Memória" },
  { id: "4", slug: "trivia", name: "Trivia" },
  { id: "5", slug: "party", name: "Party" },
];

export const STATIC_GAMES: GameRecord[] = [
  {
    id: "g-duel",
    slug: "reaction-duel",
    name: "Reaction Duel",
    description:
      "Duelo de reflexos 1v1. Espera pelo verde e clica mais rápido que o teu adversário.",
    thumbnail_url: "/games/reaction-duel-thumb.svg",
    banner_url: "/games/reaction-duel-banner.svg",
    module_id: "reaction-duel",
    guest_allowed: true,
    supports_multiplayer: true,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [
      { id: "2", slug: "arcade", name: "Arcade" },
      { id: "5", slug: "party", name: "Party" },
    ],
  },
  {
    id: "g0",
    slug: "snake",
    name: "Snake",
    description:
      "Controla a cobra, recolhe comida e tenta obter a maior pontuação possível.",
    thumbnail_url: "/games/snake-thumb.svg",
    banner_url: "/games/snake-banner.svg",
    module_id: "snake",
    guest_allowed: true,
    supports_multiplayer: false,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [{ id: "2", slug: "arcade", name: "Arcade" }],
  },
  {
    id: "g1",
    slug: "memoria-classica",
    name: "Memória Clássica",
    description:
      "Encontra todos os pares de cartas o mais rápido possível. Perfeito para sessões curtas e para treinar a memória visual.",
    thumbnail_url: "/games/memoria-thumb.svg",
    banner_url: "/games/memoria-banner.svg",
    module_id: "memory",
    guest_allowed: true,
    supports_multiplayer: true,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [
      { id: "1", slug: "puzzle", name: "Puzzle" },
      { id: "3", slug: "memory", name: "Memória" },
    ],
  },
  {
    id: "g2",
    slug: "reacao-rapida",
    name: "Reação Rápida",
    description:
      "Clica quando o ecrã ficar verde. Testa os teus reflexos e compete pelo melhor tempo de reação.",
    thumbnail_url: "/games/reacao-thumb.svg",
    banner_url: "/games/reacao-banner.svg",
    module_id: "reaction",
    guest_allowed: true,
    supports_multiplayer: false,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [{ id: "2", slug: "arcade", name: "Arcade" }],
  },
  {
    id: "g3",
    slug: "trivia-rapida",
    name: "Trivia Rápida",
    description:
      "Responde a perguntas de cultura geral contra o relógio. Ideal para jogar com amigos numa sala.",
    thumbnail_url: "/games/trivia-thumb.svg",
    banner_url: "/games/trivia-banner.svg",
    module_id: "trivia",
    guest_allowed: true,
    supports_multiplayer: true,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: false,
    status: "active",
    featured: true,
    categories: [
      { id: "4", slug: "trivia", name: "Trivia" },
      { id: "5", slug: "party", name: "Party" },
    ],
  },
];

export function getStaticGameBySlug(slug: string): GameRecord | undefined {
  const game = STATIC_GAMES.find((g) => g.slug === slug);
  return game && isPlayableGame(game) ? game : undefined;
}

export function filterGames(
  games: GameRecord[],
  opts: {
    category?: string;
    device?: DeviceCompatibility;
    query?: string;
  }
): GameRecord[] {
  return games.filter((game) => {
    if (!isPlayableGame(game)) return false;

    if (opts.category && opts.category !== "all") {
      const hasCategory = game.categories?.some((c) => c.slug === opts.category);
      if (!hasCategory) return false;
    }

    if (opts.device) {
      const key =
        opts.device === "desktop"
          ? "supports_desktop"
          : opts.device === "tablet"
            ? "supports_tablet"
            : "supports_mobile";
      if (!game[key]) return false;
    }

    if (opts.query) {
      const q = opts.query.toLowerCase();
      const haystack = `${game.name} ${game.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function gameSupportsDevice(
  game: GameRecord,
  device: DeviceCompatibility
): boolean {
  if (device === "desktop") return game.supports_desktop;
  if (device === "tablet") return game.supports_tablet;
  return game.supports_mobile;
}
