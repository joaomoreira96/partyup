import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { slugifyLabel } from "@/lib/slugify";
import { isAdmin } from "@/services/auth.service";
import type { NewsPost } from "@/types/platform";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveUniqueSlug(
  supabase: SupabaseClient,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabase.from("news_posts").select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function getVisibleNews(limit = 6): Promise<NewsPost[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as NewsPost[];
}

export async function listNewsForAdmin(): Promise<NewsPost[]> {
  if (!isSupabaseConfigured() || !(await isAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as NewsPost[];
}

export type NewsInput = {
  title: string;
  title_en: string;
  slug?: string;
  content: string;
  content_en: string;
  published?: boolean;
};

export async function createNews(
  input: NewsInput
): Promise<{ ok: true; item: NewsPost } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const title = input.title.trim();
  const titleEn = input.title_en.trim();
  const content = input.content.trim();
  const contentEn = input.content_en.trim();
  if (!title) return { ok: false, error: "title_required" };
  if (!titleEn) return { ok: false, error: "title_en_required" };
  if (!content) return { ok: false, error: "content_required" };
  if (!contentEn) return { ok: false, error: "content_en_required" };

  const supabase = await createClient();
  const baseSlug = slugifyLabel(input.slug?.trim() || title);
  const slug = await resolveUniqueSlug(supabase, baseSlug);

  const { data, error } = await supabase
    .from("news_posts")
    .insert({
      title,
      title_en: titleEn,
      slug,
      content,
      content_en: contentEn,
      published: input.published === true,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "slug_taken" };
    return { ok: false, error: error.message };
  }

  return { ok: true, item: data as NewsPost };
}

export async function updateNews(
  id: string,
  input: Partial<NewsInput>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "title_required" };
    updates.title = title;
  }
  if (input.title_en !== undefined) {
    const titleEn = input.title_en.trim();
    if (!titleEn) return { ok: false, error: "title_en_required" };
    updates.title_en = titleEn;
  }
  if (input.content !== undefined) {
    const content = input.content.trim();
    if (!content) return { ok: false, error: "content_required" };
    updates.content = content;
  }
  if (input.content_en !== undefined) {
    const contentEn = input.content_en.trim();
    if (!contentEn) return { ok: false, error: "content_en_required" };
    updates.content_en = contentEn;
  }
  if (input.published !== undefined) updates.published = input.published === true;
  if (input.slug !== undefined) {
    const baseSlug = slugifyLabel(input.slug.trim() || String(updates.title ?? ""));
    updates.slug = await resolveUniqueSlug(supabase, baseSlug, id);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "nothing_to_update" };
  }

  const { data, error } = await supabase
    .from("news_posts")
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

export async function deleteNews(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}
