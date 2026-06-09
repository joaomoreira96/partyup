import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  extractCategoriesFromLinks,
  extractCategoryIdsFromLinks,
  normalizeGameCategoryLinks,
} from "@/lib/games/normalize-category-links";
import { resolveGameCategories } from "@/lib/games/resolve-categories";
import { slugifyLabel } from "@/lib/slugify";
import { normalizeGameStatus } from "@/lib/db/mappers";
import { isAdmin } from "@/services/auth.service";
import type { AdminGameRow, Category, GameRecord, GameStatus } from "@/types/platform";

function mapRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("forbidden") || lower.includes("42501")) return "forbidden";
  if (lower.includes("name_required")) return "name_required";
  if (lower.includes("slug_required")) return "slug_required";
  if (lower.includes("game_not_found") || lower.includes("p0002")) return "game_not_found";
  if (lower.includes("invalid_status")) return "invalid_status";
  if (
    lower.includes("duplicate") ||
    lower.includes("23505") ||
    lower.includes("unique") ||
    lower.includes("slug_taken")
  ) {
    return "slug_taken";
  }
  if (lower.includes("could not find the function")) return "rpc_not_found";
  return message;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCategoryId(data: unknown): string | null {
  if (typeof data === "string") {
    const id = data.trim();
    return UUID_RE.test(id) ? id : null;
  }
  if (typeof data === "object" && data !== null && "id" in data) {
    const id = (data as { id: unknown }).id;
    return typeof id === "string" && UUID_RE.test(id.trim()) ? id.trim() : null;
  }
  return null;
}

export async function listCategoriesForAdmin(): Promise<Category[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_categories");
  if (!error && Array.isArray(data)) {
    return data as Category[];
  }

  const { data: rows, error: selectError } = await supabase
    .from("categories")
    .select("id, slug, name, name_en")
    .order("name");
  if (selectError) return [];
  return (rows ?? []) as Category[];
}

export async function createCategory(input: {
  name: string;
  name_en?: string;
  slug?: string;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };

  const nameEn = input.name_en?.trim() || name;
  const slug = slugifyLabel(input.slug?.trim() || name);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_category", {
    p_name: name,
    p_slug: slug,
    p_name_en: nameEn,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  const categoryId = parseCategoryId(data);
  if (categoryId) {
    return { ok: true, category: { id: categoryId, slug, name, name_en: nameEn } };
  }

  return {
    ok: false,
    error: `create_failed:${JSON.stringify(data)}`,
  };
}

export async function updateCategory(
  id: string,
  input: { name?: string; name_en?: string; slug?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "name_required" };
  }
  if (Object.keys(input).length === 0) {
    return { ok: false, error: "nothing_to_update" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_category", {
    p_id: id,
    p_name: input.name?.trim() ?? null,
    p_slug: input.slug !== undefined ? slugifyLabel(input.slug) : null,
    p_name_en: input.name_en !== undefined ? input.name_en.trim() : null,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    return { ok: false, error: mapped === "unknown" ? error.message : mapped };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function deleteCategory(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_category", {
    p_id: id,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    return { ok: false, error: mapped === "unknown" ? error.message : mapped };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function listGamesForAdmin(): Promise<AdminGameRow[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      `*,
      game_categories ( category_id, categories ( id, slug, name, name_en ) )`
    )
    .order("name");

  if (error || !data) return [];

  const gameIds = data.map((row) => String(row.id));
  const buildByGameId = new Map<string, GameRecord["active_build"]>();

  if (gameIds.length > 0) {
    const { data: builds } = await supabase
      .from("game_builds")
      .select("id, game_id, version, build_url, is_active")
      .in("game_id", gameIds)
      .eq("is_active", true);

    for (const build of builds ?? []) {
      buildByGameId.set(String(build.game_id), build as GameRecord["active_build"]);
    }
  }

  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, slug, name, name_en")
    .order("name");
  const categoryCatalog = (allCategories ?? []) as Category[];

  return data.map((row) => {
    const links = normalizeGameCategoryLinks(row.game_categories);
    const junctionCategories = extractCategoriesFromLinks(links);
    const legacyCategory =
      typeof row.category === "string" ? row.category : undefined;
    const categories = resolveGameCategories(
      junctionCategories,
      legacyCategory,
      categoryCatalog
    );
    const category_ids =
      links.length > 0
        ? extractCategoryIdsFromLinks(links)
        : categories.map((c) => c.id);
    const { game_categories: _, category: __, ...rest } = row;
    const game = rest as GameRecord;
    return {
      ...game,
      status: normalizeGameStatus(String(game.status)),
      runtime: (game.runtime as GameRecord["runtime"]) ?? "native",
      sdk_version: game.sdk_version ?? "1.0",
      active_build: buildByGameId.get(String(game.id)) ?? null,
      categories,
      category_ids,
    };
  });
}

async function verifyGameCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  expectedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: saved, error: verifyError } = await supabase
    .from("game_categories")
    .select("category_id")
    .eq("game_id", gameId);
  if (verifyError) {
    return { ok: false, error: verifyError.message };
  }

  const savedIds = [...new Set((saved ?? []).map((row) => row.category_id))].sort();
  const wantedIds = [...expectedIds].sort();
  if (JSON.stringify(savedIds) !== JSON.stringify(wantedIds)) {
    return { ok: false, error: "save_verification_failed" };
  }

  return { ok: true };
}

async function persistGameCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  categoryIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniqueIds = [...new Set(categoryIds)];

  const { error: deleteError } = await supabase
    .from("game_categories")
    .delete()
    .eq("game_id", gameId);
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (uniqueIds.length > 0) {
    const { error: insertError } = await supabase.from("game_categories").insert(
      uniqueIds.map((category_id) => ({ game_id: gameId, category_id }))
    );
    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  await supabase.from("games").update({ category: null }).eq("id", gameId);
  return verifyGameCategories(supabase, gameId, uniqueIds);
}

export async function setGameCategories(
  gameId: string,
  categoryIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const uniqueIds = [...new Set(categoryIds)];

  const { data, error } = await supabase.rpc("admin_set_game_categories", {
    p_game_id: gameId,
    p_category_ids: uniqueIds,
  });

  if (!error && data) {
    const verified = await verifyGameCategories(supabase, gameId, uniqueIds);
    if (verified.ok) return verified;
  }

  if (error) {
    const mapped = mapRpcError(error.message);
    if (mapped !== "rpc_not_found" && mapped !== "rpc_failed" && mapped !== "unknown") {
      return { ok: false, error: mapped };
    }
  }

  return persistGameCategories(supabase, gameId, uniqueIds);
}

export async function setGameFeatured(
  gameId: string,
  featured: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_game_featured", {
    p_game_id: gameId,
    p_featured: featured,
  });

  if (!error && data) {
    return { ok: true };
  }

  if (error) {
    const mapped = mapRpcError(error.message);
    if (mapped !== "rpc_not_found" && mapped !== "unknown") {
      return { ok: false, error: mapped };
    }
  }

  const { data: row, error: updateError } = await supabase
    .from("games")
    .update({ featured })
    .eq("id", gameId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!row) return { ok: false, error: "game_not_found" };
  return { ok: true };
}

export async function setGameStatus(
  gameId: string,
  status: Extract<GameStatus, "active" | "disabled">
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_game_status", {
    p_game_id: gameId,
    p_status: status,
  });

  if (!error && data) {
    return { ok: true };
  }

  if (error) {
    const mapped = mapRpcError(error.message);
    if (mapped !== "rpc_not_found" && mapped !== "unknown") {
      return { ok: false, error: mapped };
    }
  }

  const updates: { status: GameStatus; featured?: boolean } = { status };
  if (status === "disabled") updates.featured = false;

  const { data: row, error: updateError } = await supabase
    .from("games")
    .update(updates)
    .eq("id", gameId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!row) return { ok: false, error: "game_not_found" };
  return { ok: true };
}
