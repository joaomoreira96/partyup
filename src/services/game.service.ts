import {
  STATIC_CATEGORIES,
  STATIC_GAMES,
  filterGames,
  getStaticCatalogSupplement,
  getStaticGameBySlug,
} from "@/lib/games/catalog";
import {
  extractCategoriesFromLinks,
  normalizeGameCategoryLinks,
} from "@/lib/games/normalize-category-links";
import { resolveGameCategories } from "@/lib/games/resolve-categories";
import { isUuid, resolveSlugFromGameId } from "@/lib/games/resolve-game-id";
import { resolveGameModuleId } from "@/lib/games/resolve-module-id";
import { isPlayableGame, normalizeGameStatus } from "@/lib/db/mappers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
  const staticGame = getStaticGameBySlug(String(game.slug));
  const supportsMultiplayer =
    game.supports_multiplayer ??
    (typeof raw.is_multiplayer === "boolean" ? raw.is_multiplayer : false);

  return {
    ...game,
    status: normalizeGameStatus(String(game.status)),
    name_en: game.name_en ?? staticGame?.name_en ?? game.name,
    description_en: game.description_en ?? staticGame?.description_en,
    categories,
    supports_multiplayer: supportsMultiplayer,
    guest_allowed: game.guest_allowed ?? true,
    supports_tablet: game.supports_tablet ?? game.supports_mobile ?? true,
    runtime: (game.runtime as GameRecord["runtime"]) ?? "native",
    sdk_version: game.sdk_version ?? "1.0",
  };
}

// Caminhos locais (/games/*.svg) na BD podem estar desatualizados e apontar para
// ficheiros inexistentes. Para jogos do catálogo, usamos sempre o asset local
// correto do catálogo; uploads externos (http/storage) são preservados.
function isLocalOrEmptyAsset(value?: string | null): boolean {
  return !value || value.startsWith("/games/");
}

function resolveGameAssets(
  game: GameRecord
): Pick<GameRecord, "banner_url" | "thumbnail_url"> {
  const staticGame = getStaticGameBySlug(game.slug);
  if (!staticGame) {
    return { banner_url: game.banner_url, thumbnail_url: game.thumbnail_url };
  }
  return {
    banner_url:
      isLocalOrEmptyAsset(game.banner_url) && staticGame.banner_url
        ? staticGame.banner_url
        : game.banner_url,
    thumbnail_url:
      isLocalOrEmptyAsset(game.thumbnail_url) && staticGame.thumbnail_url
        ? staticGame.thumbnail_url
        : game.thumbnail_url,
  };
}

function finalizeGameRecord(game: GameRecord): GameRecord {
  return {
    ...game,
    ...resolveGameAssets(game),
    module_id: resolveGameModuleId(game),
  };
}

async function fetchDbGameIdBySlug(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc("resolve_game_id", {
    p_slug: slug,
  });

  if (!rpcError && rpcData) {
    const id = String(rpcData).trim();
    if (isUuid(id)) return id;
  }

  const { data, error } = await supabase
    .from("games")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

/** IDs estáticos (g1, g2…) não existem na BD — resolve para o UUID real. */
export async function resolveCanonicalGameId(
  gameId: string,
  slug?: string
): Promise<string | null> {
  const trimmed = gameId.trim();
  const resolvedSlug = slug ?? resolveSlugFromGameId(trimmed);

  if (resolvedSlug) {
    const bySlug = await fetchDbGameIdBySlug(resolvedSlug);
    if (bySlug) return bySlug;
  }

  if (isUuid(trimmed)) return trimmed;

  return null;
}

async function hydrateGameDbId(game: GameRecord): Promise<GameRecord> {
  const dbId = await resolveCanonicalGameId(game.id, game.slug);
  if (!dbId || dbId === game.id) return game;
  return { ...game, id: dbId };
}

async function fetchActiveBuild(gameId: string): Promise<GameBuild | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_builds")
    .select("id, game_id, version, build_url, is_active")
    .eq("game_id", gameId)
    .eq("is_active", true)
    .maybeSingle();

  // #region agent log
  fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game.service.ts:fetchActiveBuild',message:'fetchActiveBuild user client',data:{gameId,hasData:Boolean(data),error:error?.message??null,buildUrl:data?.build_url??null},timestamp:Date.now(),hypothesisId:'H-A-build',runId:'post-fix'})}).catch(()=>{});
  // #endregion

  if (data) return data as GameBuild;

  const service = createServiceClient();
  if (service) {
    const { data: svcData, error: svcError } = await service
      .from("game_builds")
      .select("id, game_id, version, build_url, is_active")
      .eq("game_id", gameId)
      .eq("is_active", true)
      .maybeSingle();

    // #region agent log
    fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'game.service.ts:fetchActiveBuild',message:'fetchActiveBuild service fallback',data:{gameId,hasData:Boolean(svcData),error:svcError?.message??null,buildUrl:svcData?.build_url??null},timestamp:Date.now(),hypothesisId:'H-A-build',runId:'post-fix'})}).catch(()=>{});
    // #endregion

    if (svcData) return svcData as GameBuild;
  }

  if (error) {
    console.warn("[fetchActiveBuild]", gameId, error.message);
  }

  return null;
}

async function fetchAllCategoriesFromDb(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("name");
  return (data as Category[]) ?? [];
}

function parseCatalogSlugRows(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (typeof row === "string") return row;
      if (typeof row === "object" && row !== null && "slug" in row) {
        return String((row as { slug: unknown }).slug);
      }
      return null;
    })
    .filter((slug): slug is string => Boolean(slug));
}

async function fetchKnownGameSlugsFromDb(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_game_catalog_slugs");
  if (!error && Array.isArray(data)) {
    const slugs = parseCatalogSlugRows(data);
    if (slugs.length) return new Set(slugs);
  }

  const { data: rows, error: selectError } = await supabase.from("games").select("slug");
  if (selectError || !rows?.length) return new Set();

  return new Set(rows.map((row) => row.slug));
}

async function fetchGamesFromDb(): Promise<GameRecord[]> {
  const supabase = await createClient();
  const [allCategories, gamesResult] = await Promise.all([
    fetchAllCategoriesFromDb(),
    supabase
      .from("games")
      .select(
        `*,
        game_categories ( categories ( id, slug, name, name_en ) )`
      )
      .eq("status", "active")
      .order("name"),
  ]);

  const { data: games, error } = gamesResult;
  if (error) {
    console.warn("[fetchGamesFromDb] query failed:", error.message);
    return [];
  }
  if (!games?.length) return [];

  return Promise.all(
    games.map(async (row) => {
      const links = normalizeGameCategoryLinks(row.game_categories);
      const junctionCategories = extractCategoriesFromLinks(links);
      const legacyCategory =
        typeof row.category === "string" ? row.category : undefined;
      const categories = resolveGameCategories(
        junctionCategories,
        legacyCategory,
        allCategories
      );
      const { game_categories: _, category: __, ...rest } = row;
      const mapped = mapGameRow(rest as Record<string, unknown>, categories);
      mapped.active_build = await fetchActiveBuild(mapped.id);
      return finalizeGameRecord(mapped);
    })
  );
}

async function fetchGameBySlugFromDb(slug: string): Promise<GameRecord | null> {
  const supabase = await createClient();
  const [allCategories, gameResult] = await Promise.all([
    fetchAllCategoriesFromDb(),
    supabase
      .from("games")
      .select(
        `*,
        game_categories ( categories ( id, slug, name, name_en ) )`
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const { data, error } = gameResult;
  if (error || !data) return null;

  const links = normalizeGameCategoryLinks(data.game_categories);
  const junctionCategories = extractCategoriesFromLinks(links);
  const legacyCategory =
    typeof data.category === "string" ? data.category : undefined;
  const categories = resolveGameCategories(
    junctionCategories,
    legacyCategory,
    allCategories
  );

  const { game_categories: _, category: __, ...rest } = data;
  const mapped = mapGameRow(rest as Record<string, unknown>, categories);
  mapped.active_build = await fetchActiveBuild(mapped.id);
  return finalizeGameRecord(mapped);
}

export async function resolveModuleIdForGame(
  gameId: string
): Promise<string | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const canonicalId = await resolveCanonicalGameId(gameId);
  if (!canonicalId) return undefined;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("slug")
    .eq("id", canonicalId)
    .maybeSingle();

  if (!game?.slug) return undefined;

  const build = await fetchActiveBuild(canonicalId);
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

async function buildStaticCatalogFallback(
  slugs?: ReadonlySet<string>
): Promise<GameRecord[]> {
  const games = slugs
    ? STATIC_GAMES.filter((g) => isPlayableGame(g) && slugs.has(g.slug))
    : STATIC_GAMES.filter(isPlayableGame);

  return Promise.all(
    games.map((game) => hydrateGameDbId(finalizeGameRecord(game)))
  );
}

async function resolveCatalogGames(): Promise<GameRecord[]> {
  if (!isSupabaseConfigured()) {
    return STATIC_GAMES.filter(isPlayableGame).map(finalizeGameRecord);
  }

  try {
    const [fromDb, knownSlugs] = await Promise.all([
      fetchGamesFromDb(),
      fetchKnownGameSlugsFromDb(),
    ]);

    const dbSlugs = new Set(fromDb.map((g) => g.slug));
    const supplements = await Promise.all(
      getStaticCatalogSupplement(new Set([...knownSlugs, ...dbSlugs]))
        .map(finalizeGameRecord)
        .map((game) => hydrateGameDbId(game))
    );

    let merged = [...fromDb, ...supplements];

    // BD tem jogos mas a query de ativos falhou (ex.: schema hosted) — usa catálogo estático
    if (merged.length === 0 && knownSlugs.size > 0) {
      merged = await buildStaticCatalogFallback(knownSlugs);
    }

    if (merged.length === 0) {
      merged = await buildStaticCatalogFallback();
    }

    return merged;
  } catch {
    return buildStaticCatalogFallback();
  }
}

export async function getPublishedGames(
  filters?: GameFilters
): Promise<GameRecord[]> {
  const games = await resolveCatalogGames();

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
  if (!staticGame || !isPlayableGame(staticGame)) return null;
  return hydrateGameDbId(finalizeGameRecord(staticGame));
}

export async function getFeaturedGames(): Promise<GameRecord[]> {
  const all = await getPublishedGames();
  return all.filter((g) => g.featured);
}

export async function getRecentlyAddedGames(limit = 4): Promise<GameRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const [allCategories, gamesResult] = await Promise.all([
        fetchAllCategoriesFromDb(),
        supabase
          .from("games")
          .select(
            `*,
            game_categories ( categories ( id, slug, name, name_en ) )`
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const { data: games, error } = gamesResult;
      if (!error && games?.length) {
        return Promise.all(
          games.map(async (row) => {
            const links = normalizeGameCategoryLinks(row.game_categories);
            const junctionCategories = extractCategoriesFromLinks(links);
            const legacyCategory =
              typeof row.category === "string" ? row.category : undefined;
            const categories = resolveGameCategories(
              junctionCategories,
              legacyCategory,
              allCategories
            );
            const { game_categories: _, category: __, ...rest } = row;
            const mapped = mapGameRow(rest as Record<string, unknown>, categories);
            mapped.active_build = await fetchActiveBuild(mapped.id);
            return finalizeGameRecord(mapped);
          })
        );
      }
    } catch {
      /* fallback */
    }
  }

  const all = STATIC_GAMES.filter(isPlayableGame);
  return all.slice(0, limit);
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
