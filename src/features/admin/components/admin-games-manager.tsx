"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Power, PowerOff, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/locale-provider";
import { getCategoryName } from "@/lib/category-localized";
import { getGameName } from "@/lib/game-localized";
import type { AdminGameRow, Category } from "@/types/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { normalizeGameStatus } from "@/lib/db/mappers";
import { ADMIN_PAGE_SIZE, paginateSlice, parsePageParam } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type AdminGamesManagerProps = {
  initialCategories: Category[];
  initialGames: AdminGameRow[];
};

export function AdminGamesManager({
  initialCategories,
  initialGames,
}: AdminGamesManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const [categories, setCategories] = useState(initialCategories);
  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        getCategoryName(a, locale).localeCompare(getCategoryName(b, locale))
      ),
    [categories, locale]
  );
  const [games, setGames] = useState(initialGames);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryNameEn, setNewCategoryNameEn] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const gamesPage = parsePageParam(searchParams.get("page"));
  const gamesPagination = useMemo(
    () => paginateSlice(games, gamesPage, ADMIN_PAGE_SIZE),
    [games, gamesPage]
  );
  const pagedGames = gamesPagination.items;
  const [draftCategories, setDraftCategories] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialGames.map((g) => [g.id, g.category_ids]))
  );

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    const nameEn = newCategoryNameEn.trim();
    if (!name) return;

    setCreatingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, name_en: nameEn || name }),
      });
      const data = (await res.json()) as {
        message?: string;
        detail?: string;
        category?: Category;
      };
      if (!res.ok) {
        const hint = data.detail && data.detail !== data.message ? ` (${data.detail})` : "";
        toast.error(`${data.message ?? "Não foi possível criar a categoria."}${hint}`);
        return;
      }
      if (data.category) {
        setCategories((prev) =>
          [...prev, data.category!].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      setNewCategoryName("");
      setNewCategoryNameEn("");
      toast.success("Categoria criada.");
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm("Apagar esta categoria? Os jogos deixam de a ter associada.")) return;

    const res = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      toast.error(data.message ?? "Não foi possível apagar.");
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setDraftCategories((prev) => {
      const next = { ...prev };
      for (const gameId of Object.keys(next)) {
        next[gameId] = next[gameId].filter((cid) => cid !== id);
      }
      return next;
    });
    toast.success("Categoria apagada.");
  }

  function toggleGameCategory(gameId: string, categoryId: string) {
    setDraftCategories((prev) => {
      const current = prev[gameId] ?? [];
      const has = current.includes(categoryId);
      return {
        ...prev,
        [gameId]: has
          ? current.filter((id) => id !== categoryId)
          : [...current, categoryId],
      };
    });
  }

  async function toggleGameStatus(gameId: string, activate: boolean) {
    const status = activate ? "active" : "disabled";
    setSavingStatusId(gameId);
    try {
      const res = await fetch("/api/admin/games/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, status }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível atualizar o estado do jogo.");
        return;
      }

      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? {
                ...g,
                status,
                featured: status === "disabled" ? false : g.featured,
              }
            : g
        )
      );
      toast.success(activate ? "Jogo ativado." : "Jogo desativado.");
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setSavingStatusId(null);
    }
  }

  async function toggleFeatured(gameId: string, featured: boolean) {
    setSavingFeaturedId(gameId);
    try {
      const res = await fetch("/api/admin/games/featured", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, featured }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível atualizar o destaque.");
        return;
      }

      setGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, featured } : g))
      );
      toast.success(featured ? "Jogo adicionado aos destaques." : "Jogo removido dos destaques.");
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setSavingFeaturedId(null);
    }
  }

  async function saveGameCategories(gameId: string) {
    setSavingGameId(gameId);
    try {
      const res = await fetch("/api/admin/games/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          categoryIds: draftCategories[gameId] ?? [],
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível guardar.");
        return;
      }

      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? {
                ...g,
                category_ids: draftCategories[gameId] ?? [],
                categories: categories.filter((c) =>
                  (draftCategories[gameId] ?? []).includes(c.id)
                ),
              }
            : g
        )
      );
      toast.success("Categorias do jogo atualizadas.");
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setSavingGameId(null);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-base font-semibold">Categorias</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria categorias e atribui-as aos jogos abaixo.
        </p>

        <form onSubmit={(e) => void createCategory(e)} className="mt-4 flex flex-wrap gap-2">
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="new-category" className="sr-only">
              Nome em português
            </Label>
            <Input
              id="new-category"
              placeholder="Nome (PT)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="new-category-en" className="sr-only">
              Nome em inglês
            </Label>
            <Input
              id="new-category-en"
              placeholder="Nome (EN)"
              value={newCategoryNameEn}
              onChange={(e) => setNewCategoryNameEn(e.target.value)}
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={creatingCategory}>
            <Plus className="size-4" aria-hidden />
            {creatingCategory ? "A criar..." : "Adicionar"}
          </Button>
        </form>

        {sortedCategories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Ainda não há categorias.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {sortedCategories.map((cat) => (
              <li
                key={cat.id}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
              >
                <span>{getCategoryName(cat, locale)}</span>
                <span className="text-xs text-muted-foreground">/{cat.slug}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Apagar ${getCategoryName(cat, locale)}`}
                  onClick={() => void deleteCategory(cat.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold">Jogos e categorias</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Um jogo pode pertencer a várias categorias.
        </p>

        {games.length === 0 ? (
          <p className="mt-4 rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum jogo na base de dados.
          </p>
        ) : (
          <>
          <ul className="mt-4 space-y-4">
            {pagedGames.map((game) => {
              const selected = draftCategories[game.id] ?? [];
              const dirty =
                JSON.stringify([...selected].sort()) !==
                JSON.stringify([...game.category_ids].sort());
              const normalizedStatus = normalizeGameStatus(game.status);
              const isActive = normalizedStatus === "active";

              return (
                <li
                  key={game.id}
                  className={cn(
                    "rounded-lg border p-4",
                    !isActive && "opacity-75"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{getGameName(game, locale)}</p>
                      <p className="text-xs text-muted-foreground">{game.slug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={game.featured ? "default" : "outline"}
                        disabled={
                          savingFeaturedId === game.id ||
                          !isActive
                        }
                        aria-pressed={!!game.featured}
                        onClick={() => void toggleFeatured(game.id, !game.featured)}
                      >
                        {savingFeaturedId === game.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Star
                            className={cn("size-4", game.featured && "fill-current")}
                            aria-hidden
                          />
                        )}
                        Destaques
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? "outline" : "secondary"}
                        disabled={savingStatusId === game.id}
                        onClick={() => void toggleGameStatus(game.id, !isActive)}
                      >
                        {savingStatusId === game.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : isActive ? (
                          <PowerOff className="size-4" aria-hidden />
                        ) : (
                          <Power className="size-4" aria-hidden />
                        )}
                        {isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Badge variant={isActive ? "outline" : "secondary"}>
                        {isActive ? "Ativo" : normalizedStatus === "draft" ? "Rascunho" : "Desativado"}
                      </Badge>
                    </div>
                  </div>

                  {sortedCategories.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Cria categorias primeiro.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sortedCategories.map((cat) => {
                        const checked = selected.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                              checked ? "border-primary bg-primary/10" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="size-4 rounded border"
                              checked={checked}
                              onChange={() => toggleGameCategory(game.id, cat.id)}
                            />
                            {getCategoryName(cat, locale)}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    className="mt-3"
                    size="sm"
                    variant={dirty ? "default" : "outline"}
                    disabled={!dirty || savingGameId === game.id || sortedCategories.length === 0}
                    onClick={() => void saveGameCategories(game.id)}
                  >
                    {savingGameId === game.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        A guardar...
                      </>
                    ) : (
                      "Guardar categorias"
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
          <PaginationControls
            page={gamesPagination.page}
            totalPages={gamesPagination.totalPages}
            totalItems={gamesPagination.totalItems}
            rangeStart={gamesPagination.rangeStart}
            rangeEnd={gamesPagination.rangeEnd}
            className="mt-4"
          />
          </>
        )}
      </section>
    </div>
  );
}
