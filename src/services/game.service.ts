import {
  STATIC_CATEGORIES,
  STATIC_GAMES,
  filterGames,
  getStaticGameBySlug,
} from "@/lib/games/catalog";
import { resolveGameModuleId } from "@/lib/games/resolve-module-id";
import { FEATURED_GAME_SLUGS } from "@/lib/constants";
import { isPlayableGame, normalizeGameStatus } from "@/lib/db/mappers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  DeviceCompatibility,
  GameBuild,
  GameRecord,
  GameStats,
} from "@/types/platform";

export type GameFilters = {
  category?: string;
  device?: DeviceCompatibility;
  query?: string;
  multiplayer?: "all" | "yes" | "no";
  mobile?: "all" | "yes" | "no";
  desktop?: "all" | "yes" | "no";
};

function mapGameRow(row: Record<string, unknown>, categories: Category[]): GameRecord {
  const raw = row as Record<string, unknown> & Partial<GameRecord>;
  const game = raw as unknown as GameRecord;
  const supportsMultiplayer =
    game.supports_multiplayer ??
    (typeof raw.is_multiplayer === "boolean" ? raw.is_multiplayer : false);

  return {
    ...game,
    status: normalizeGameStatus(String(game.status)),
    categories,
    supports_multiplayer: supportsMultiplayer,
    guest_allowed: game.guest_allowed ?? true,
    supports_tablet: game.supports_tablet ?? game.supports_mobile ?? true,
  };
}

function finalizeGameRecord(game: GameRecord): GameRecord {
  return {
    ...game,
    module_id: resolveGameModuleId(game),
  };
}

async function fetchActiveBuild(gameId: string): Promise<GameBuild | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_builds")
    .select("id, game_id, version, build_url, is_active")
    .eq("game_id", gameId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as GameBuild) ?? null;
}

async function fetchGamesFromDb(): Promise<GameRecord[]> {
  const supabase = await createClient();
  const { data: games, error } = await supabase
    .from("games")
    .select(
      `*,
      game_categories ( categories ( id, slug, name ) )`
    )
    .eq("status", "active")
    .order("name");

  if (error || !games?.length) return [];

  return Promise.all(
    games.map(async (row) => {
      const categories =
        (
          row.game_categories as { categories: Category | null }[] | null
        )
          ?.map((gc) => gc.categories)
          .filter((c): c is Category => c != null) ?? [];
      const { game_categories: _, ...rest } = row;
      const mapped = mapGameRow(rest as Record<string, unknown>, categories);
      mapped.active_build = await fetchActiveBuild(mapped.id);
      return finalizeGameRecord(mapped);
    })
  );
}

async function fetchGameBySlugFromDb(slug: string): Promise<GameRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      `*,
      game_categories ( categories ( id, slug, name ) )`
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  const categories =
    (data.game_categories as { categories: Category | null }[] | null)
      ?.map((gc) => gc.categories)
      .filter((c): c is Category => c != null) ?? [];

  const { game_categories: _, ...rest } = data;
  const mapped = mapGameRow(rest as Record<string, unknown>, categories);
  mapped.active_build = await fetchActiveBuild(mapped.id);
  return finalizeGameRecord(mapped);
}

export async function resolveModuleIdForGame(
  gameId: string
): Promise<string | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("slug")
    .eq("id", gameId)
    .maybeSingle();

  if (!game?.slug) return undefined;

  const build = await fetchActiveBuild(gameId);
  return resolveGameModuleId({
    slug: game.slug,
    module_id: "",
    active_build: build,
  });
}

function applyMultiplayerFilter(
  games: GameRecord[],
  multiplayer?: GameFilters["multiplayer"]
): GameRecord[] {
  if (!multiplayer || multiplayer === "all") return games;
  if (multiplayer === "yes") return games.filter((g) => g.supports_multiplayer);
  return games.filter((g) => !g.supports_multiplayer);
}

export async function getPublishedGames(
  filters?: GameFilters
): Promise<GameRecord[]> {
  let games: GameRecord[] = [];

  if (isSupabaseConfigured()) {
    try {
      games = await fetchGamesFromDb();
    } catch {
      games = [];
    }
  }

  if (!games.length) {
    games = STATIC_GAMES.filter(isPlayableGame);
  }

  const filtered = filterGames(games, {
    category: filters?.category,
    device: filters?.device,
    query: filters?.query,
  });

  let result = applyMultiplayerFilter(filtered, filters?.multiplayer);

  if (filters?.mobile === "yes") result = result.filter((g) => g.supports_mobile);
  if (filters?.mobile === "no") result = result.filter((g) => !g.supports_mobile);
  if (filters?.desktop === "yes") result = result.filter((g) => g.supports_desktop);
  if (filters?.desktop === "no") result = result.filter((g) => !g.supports_desktop);

  return result;
}

export async function getGameBySlug(slug: string): Promise<GameRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const fromDb = await fetchGameBySlugFromDb(slug);
      if (fromDb) return fromDb;
    } catch {
      /* fallback */
    }
  }
  const staticGame = getStaticGameBySlug(slug);
  return staticGame && isPlayableGame(staticGame) ? staticGame : null;
}

export async function getFeaturedGames(): Promise<GameRecord[]> {
  const all = await getPublishedGames();
  const featured = FEATURED_GAME_SLUGS.map((slug) =>
    all.find((g) => g.slug === slug)
  ).filter((g): g is GameRecord => g != null);
  return featured.length ? featured : all.filter((g) => g.featured).slice(0, 3) || all.slice(0, 3);
}

export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (data?.length) return data as Category[];
    } catch {
      /* fallback */
    }
  }
  return STATIC_CATEGORIES;
}

export async function getGameStats(gameId: string): Promise<GameStats | null> {
  if (!isSupabaseConfigured()) {
    return {
      game_id: gameId,
      total_sessions: 0,
      total_players: 0,
      total_play_time_seconds: 0,
      highest_score: 0,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("game_stats")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  if (!data) return null;

  return {
    game_id: data.game_id,
    total_sessions: data.total_sessions ?? data.sessions_count ?? 0,
    total_players: data.total_players ?? data.unique_players ?? 0,
    total_play_time_seconds: Number(data.total_play_time_seconds ?? 0),
    highest_score: Number(data.highest_score ?? data.max_score ?? 0),
  };
}

export async function getActiveBuildForGame(
  gameId: string
): Promise<GameBuild | null> {
  if (!isSupabaseConfigured()) return null;
  return fetchActiveBuild(gameId);
}
