"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminGameRow, Category } from "@/types/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminGamesManagerProps = {
  initialCategories: Category[];
  initialGames: AdminGameRow[];
};

export function AdminGamesManager({
  initialCategories,
  initialGames,
}: AdminGamesManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [games, setGames] = useState(initialGames);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [draftCategories, setDraftCategories] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialGames.map((g) => [g.id, g.category_ids]))
  );

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    setCreatingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { message?: string; category?: Category };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível criar a categoria.");
        return;
      }
      if (data.category) {
        setCategories((prev) =>
          [...prev, data.category!].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      setNewCategoryName("");
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
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="new-category" className="sr-only">
              Nova categoria
            </Label>
            <Input
              id="new-category"
              placeholder="Nome da categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={creatingCategory}>
            <Plus className="size-4" aria-hidden />
            {creatingCategory ? "A criar..." : "Adicionar"}
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Ainda não há categorias.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
              >
                <span>{cat.name}</span>
                <span className="text-xs text-muted-foreground">/{cat.slug}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Apagar ${cat.name}`}
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
          <ul className="mt-4 space-y-4">
            {games.map((game) => {
              const selected = draftCategories[game.id] ?? [];
              const dirty =
                JSON.stringify([...selected].sort()) !==
                JSON.stringify([...game.category_ids].sort());

              return (
                <li key={game.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{game.name}</p>
                      <p className="text-xs text-muted-foreground">{game.slug}</p>
                    </div>
                    <Badge variant="outline">{game.status}</Badge>
                  </div>

                  {categories.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Cria categorias primeiro.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {categories.map((cat) => {
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
                            {cat.name}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    className="mt-3"
                    size="sm"
                    variant={dirty ? "default" : "outline"}
                    disabled={!dirty || savingGameId === game.id || categories.length === 0}
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
        )}
      </section>
    </div>
  );
}
