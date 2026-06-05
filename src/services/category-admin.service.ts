import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { slugifyLabel } from "@/lib/slugify";
import { normalizeGameStatus } from "@/lib/db/mappers";
import { isAdmin } from "@/services/auth.service";
import type { AdminGameRow, Category, GameRecord } from "@/types/platform";

function mapRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("forbidden") || lower.includes("42501")) return "forbidden";
  if (lower.includes("name_required")) return "name_required";
  if (lower.includes("slug_required")) return "slug_required";
  if (lower.includes("game_not_found") || lower.includes("p0002")) return "game_not_found";
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
    .select("id, slug, name")
    .order("name");
  if (selectError) return [];
  return (rows ?? []) as Category[];
}

export async function createCategory(input: {
  name: string;
  slug?: string;
}): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };

  const slug = slugifyLabel(input.slug?.trim() || name);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_category", {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  const categoryId = parseCategoryId(data);
  if (categoryId) {
    return { ok: true, category: { id: categoryId, slug, name } };
  }

  return {
    ok: false,
    error: `create_failed:${JSON.stringify(data)}`,
  };
}

export async function updateCategory(
  id: string,
  input: { name?: string; slug?: string }
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
      game_categories ( category_id, categories ( id, slug, name ) )`
    )
    .order("name");

  if (error || !data) return [];

  return data.map((row) => {
    const links = row.game_categories as
      | { category_id: string; categories: Category | null }[]
      | null;
    const categories =
      links?.map((l) => l.categories).filter((c): c is Category => c != null) ??
      [];
    const category_ids = links?.map((l) => l.category_id) ?? [];
    const { game_categories: _, ...rest } = row;
    const game = rest as GameRecord;
    return {
      ...game,
      status: normalizeGameStatus(String(game.status)),
      categories,
      category_ids,
    };
  });
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

  if (error) {
    const mapped = mapRpcError(error.message);
    return { ok: false, error: mapped === "unknown" ? error.message : mapped };
  }
  if (!data) return { ok: false, error: "game_not_found" };
  return { ok: true };
}
