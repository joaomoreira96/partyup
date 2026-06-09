import { isPlayableGame } from "@/lib/db/mappers";
import {
  gameCategorySearchText,
  gameMatchesCategorySlug,
} from "@/lib/games/resolve-categories";
import type { Category, DeviceCompatibility, GameRecord } from "@/types/platform";

/** Static catalog fallback when Supabase is unavailable (local dev). */
export const STATIC_CATEGORIES: Category[] = [
  { id: "1", slug: "puzzle", name: "Puzzle", name_en: "Puzzle" },
  { id: "2", slug: "arcade", name: "Arcade", name_en: "Arcade" },
  { id: "3", slug: "memory", name: "Memória", name_en: "Memory" },
  { id: "4", slug: "trivia", name: "Trivia", name_en: "Trivia" },
  { id: "5", slug: "party", name: "Party", name_en: "Party" },
];

export const STATIC_GAMES: GameRecord[] = [
  {
    id: "g-click-frenzy",
    slug: "click-frenzy",
    name: "Click Frenzy",
    name_en: "Click Frenzy",
    description:
      "Clica o mais rápido possível durante 15 segundos. Vence quem fizer mais cliques. Até 8 jogadores.",
    description_en:
      "Click as fast as you can for 15 seconds. Whoever gets the most clicks wins. Up to 8 players.",
    thumbnail_url: "/games/click-frenzy-thumb.svg",
    banner_url: "/games/click-frenzy-banner.svg",
    module_id: "click-frenzy",
    guest_allowed: true,
    supports_multiplayer: true,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [
      { id: "5", slug: "party", name: "Party", name_en: "Party" },
      { id: "2", slug: "arcade", name: "Arcade", name_en: "Arcade" },
    ],
  },
  {
    id: "g-duel",
    slug: "reaction-duel",
    name: "Duelo de Reação",
    name_en: "Reaction Duel",
    description:
      "Duelo de reflexos 1v1. Espera pelo verde e clica mais rápido que o teu adversário.",
    description_en:
      "1v1 reflex duel. Wait for green and click faster than your opponent.",
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
      { id: "2", slug: "arcade", name: "Arcade", name_en: "Arcade" },
      { id: "5", slug: "party", name: "Party", name_en: "Party" },
    ],
  },
  {
    id: "g0",
    slug: "snake",
    name: "Snake",
    name_en: "Snake",
    description:
      "Controla a cobra, recolhe comida e tenta obter a maior pontuação possível.",
    description_en:
      "Control the snake, collect food and try to get the highest score possible.",
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
    categories: [{ id: "2", slug: "arcade", name: "Arcade", name_en: "Arcade" }],
  },
  {
    id: "g1",
    slug: "memoria-classica",
    name: "Memória Clássica",
    name_en: "Classic Memory",
    description:
      "Encontra todos os pares de cartas o mais rápido possível. Perfeito para sessões curtas e para treinar a memória visual.",
    description_en:
      "Find all matching card pairs as fast as you can. Perfect for short sessions and visual memory training.",
    thumbnail_url: "/games/memoria-thumb.svg",
    banner_url: "/games/memoria-banner.svg",
    module_id: "memory",
    guest_allowed: true,
    supports_multiplayer: false,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [
      { id: "1", slug: "puzzle", name: "Puzzle", name_en: "Puzzle" },
      { id: "3", slug: "memory", name: "Memória", name_en: "Memory" },
    ],
  },
  {
    id: "g2",
    slug: "reacao-rapida",
    name: "Reação Rápida",
    name_en: "Quick Reaction",
    description:
      "Clica quando o ecrã ficar verde. Testa os teus reflexos e compete pelo melhor tempo de reação.",
    description_en:
      "Click when the screen turns green. Test your reflexes and compete for the best reaction time.",
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
    categories: [{ id: "2", slug: "arcade", name: "Arcade", name_en: "Arcade" }],
  },
  {
    id: "g3",
    slug: "trivia-rapida",
    name: "Trivia Rápida",
    name_en: "Quick Trivia",
    description:
      "Responde a perguntas de cultura geral contra o relógio. Ideal para sessões rápidas a solo.",
    description_en:
      "Answer general knowledge questions against the clock. Ideal for quick solo sessions.",
    thumbnail_url: "/games/trivia-thumb.svg",
    banner_url: "/games/trivia-banner.svg",
    module_id: "trivia",
    guest_allowed: true,
    supports_multiplayer: false,
    supports_desktop: true,
    supports_tablet: true,
    supports_mobile: true,
    status: "active",
    featured: true,
    categories: [
      { id: "4", slug: "trivia", name: "Trivia", name_en: "Trivia" },
      { id: "5", slug: "party", name: "Party", name_en: "Party" },
    ],
  },
];

export function getStaticGameBySlug(slug: string): GameRecord | undefined {
  const game = STATIC_GAMES.find((g) => g.slug === slug);
  return game && isPlayableGame(game) ? game : undefined;
}

/** Jogos do catálogo estático cujo slug ainda não existe na BD (ex.: migração em falta). */
export function getStaticCatalogSupplement(knownSlugs: ReadonlySet<string>): GameRecord[] {
  return STATIC_GAMES.filter(
    (game) => isPlayableGame(game) && !knownSlugs.has(game.slug)
  );
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
      if (!gameMatchesCategorySlug(game.categories, opts.category)) return false;
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
      const haystack =
        `${game.name} ${game.name_en ?? ""} ${game.description} ${game.description_en ?? ""} ${gameCategorySearchText(game.categories)}`.toLowerCase();
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
