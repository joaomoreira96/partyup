import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { slugifyLabel } from "@/lib/slugify";
import { normalizeGameStatus } from "@/lib/db/mappers";
import { isAdmin } from "@/services/auth.service";
import type { AdminGameRow, Category, GameRecord } from "@/types/platform";

export async function listCategoriesForAdmin(): Promise<Category[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) return [];
  return (data ?? []) as Category[];
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
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "slug_taken" };
    return { ok: false, error: error.message };
  }

  return { ok: true, category: data as Category };
}

export async function updateCategory(
  id: string,
  input: { name?: string; slug?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const updates: Partial<Category> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "name_required" };
    updates.name = name;
  }
  if (input.slug !== undefined) {
    updates.slug = slugifyLabel(input.slug);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "nothing_to_update" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "slug_taken" };
    return { ok: false, error: error.message };
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
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
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
    .is("deleted_at", null)
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

  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!game) return { ok: false, error: "game_not_found" };

  const { error: deleteError } = await supabase
    .from("game_categories")
    .delete()
    .eq("game_id", gameId);

  if (deleteError) return { ok: false, error: deleteError.message };

  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) return { ok: true };

  const { error: insertError } = await supabase.from("game_categories").insert(
    uniqueIds.map((category_id) => ({
      game_id: gameId,
      category_id,
    }))
  );

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}
