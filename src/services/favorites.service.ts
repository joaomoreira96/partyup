import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { getPublishedGames } from "@/services/game.service";
import type { GameRecord } from "@/types/platform";

export async function getUserFavoriteGameIds(userId: string): Promise<string[]> {
  if (!userId || !isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_user_favorite_game_ids",
    { p_user_id: userId }
  );

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map(String);
  }

  if (rpcError) {
    console.warn(
      "[getUserFavoriteGameIds] RPC failed, trying direct select:",
      rpcError.message
    );
  }

  const { data, error } = await supabase
    .from("favorite_games")
    .select("game_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getUserFavoriteGameIds] select failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => String(row.game_id));
}

export async function isGameFavorite(
  userId: string,
  gameId: string
): Promise<boolean> {
  const ids = await getUserFavoriteGameIds(userId);
  return ids.includes(gameId);
}

export async function getUserFavoriteGames(userId: string): Promise<GameRecord[]> {
  const ids = await getUserFavoriteGameIds(userId);
  if (!ids.length) return [];

  const published = await getPublishedGames();
  const byId = new Map(published.map((game) => [game.id, game]));

  return ids
    .map((id) => byId.get(id))
    .filter((game): game is GameRecord => game != null);
}

export type ToggleFavoriteResult =
  | { ok: true; isFavorite: boolean }
  | { ok: false; error: string };

export async function toggleFavoriteGame(gameId: string): Promise<ToggleFavoriteResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "offline" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("toggle_favorite_game", {
    p_game_id: gameId,
  });

  if (!error && data && typeof data === "object") {
    const row = data as { ok?: boolean; is_favorite?: boolean; error?: string };
    if (row.ok === false) {
      return { ok: false, error: row.error ?? "unknown" };
    }
    return { ok: true, isFavorite: Boolean(row.is_favorite) };
  }

  if (error) {
    console.warn("[toggleFavoriteGame] RPC failed, trying direct:", error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }

  const { data: existing } = await supabase
    .from("favorite_games")
    .select("game_id")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorite_games")
      .delete()
      .eq("user_id", user.id)
      .eq("game_id", gameId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
    return { ok: true, isFavorite: false };
  }

  const { error: insertError } = await supabase.from("favorite_games").insert({
    user_id: user.id,
    game_id: gameId,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, isFavorite: true };
}
