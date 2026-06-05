"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getNewsContent, getNewsTitle } from "@/lib/news-localized";
import { newsExcerpt } from "@/lib/news-excerpt";
import { slugifyLabel } from "@/lib/slugify";
import type { NewsPost } from "@/types/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NewsForm = {
  title: string;
  title_en: string;
  slug: string;
  content: string;
  content_en: string;
  published: boolean;
};

const emptyForm = (): NewsForm => ({
  title: "",
  title_en: "",
  slug: "",
  content: "",
  content_en: "",
  published: false,
});

function toForm(item: NewsPost): NewsForm {
  return {
    title: item.title,
    title_en: item.title_en,
    slug: item.slug,
    content: item.content,
    content_en: item.content_en,
    published: item.published,
  };
}

function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminNewsManager({ initialNews }: { initialNews: NewsPost[] }) {
  const [items, setItems] = useState(initialNews);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(item: NewsPost) {
    setEditingId(item.id);
    setForm(toForm(item));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function refreshList() {
    const res = await fetch("/api/admin/news");
    if (!res.ok) return;
    const data = (await res.json()) as { news: NewsPost[] };
    setItems(data.news);
  }

  function validateForm(): boolean {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Preenche título e conteúdo em português.");
      return false;
    }
    if (!form.title_en.trim() || !form.content_en.trim()) {
      toast.error("Preenche título e conteúdo em inglês.");
      return false;
    }
    return true;
  }

  async function saveNews() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        title_en: form.title_en.trim(),
        content: form.content.trim(),
        content_en: form.content_en.trim(),
        published: form.published,
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      };

      const res = await fetch("/api/admin/news", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });

      const data = (await res.json()) as { message?: string; item?: NewsPost };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível guardar.");
        return;
      }

      toast.success(
        editingId
          ? "News atualizada."
          : data.item?.published
            ? "News criada e publicada."
            : "News criada como rascunho."
      );
      closeDialog();
      if (!editingId && data.item) {
        setItems((prev) => [data.item!, ...prev]);
      } else {
        await refreshList();
      }
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: NewsPost) {
    const res = await fetch("/api/admin/news", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, published: !item.published }),
    });
    if (!res.ok) {
      toast.error("Não foi possível alterar a visibilidade.");
      return;
    }
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, published: !n.published } : n))
    );
  }

  async function deleteItem(id: string) {
    if (!window.confirm("Apagar esta news?")) return;

    const res = await fetch("/api/admin/news", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      toast.error("Não foi possível apagar.");
      return;
    }
    setItems((prev) => prev.filter((n) => n.id !== id));
    toast.success("News apagada.");
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">News</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conteúdo em português e inglês. Publicadas na homepage; rascunhos só aqui.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Nova news
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
            Ainda não há news. Cria a primeira.
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  {item.published ? (
                    <Badge className="gap-1">
                      <Eye className="size-3" aria-hidden />
                      Publicada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="size-3" aria-hidden />
                      Rascunho
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNewsDate(item.created_at)} · /{item.slug}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  EN: {getNewsTitle(item, "en")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {newsExcerpt(getNewsContent(item, "pt"))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void togglePublished(item)}
                >
                  {item.published ? "Despublicar" : "Publicar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void deleteItem(item.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar news" : "Nova news"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="news-slug">Slug (URL)</Label>
              <Input
                id="news-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="gerado-a-partir-do-titulo-pt"
                maxLength={48}
                spellCheck={false}
              />
            </div>

            <Tabs defaultValue="pt">
              <TabsList className="w-full">
                <TabsTrigger value="pt" className="flex-1">
                  Português
                </TabsTrigger>
                <TabsTrigger value="en" className="flex-1">
                  English
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pt" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="news-title-pt">Título (PT)</Label>
                  <Input
                    id="news-title-pt"
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((f) => ({
                        ...f,
                        title,
                        slug:
                          !editingId && !f.slug
                            ? slugifyLabel(title)
                            : f.slug,
                      }));
                    }}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="news-content-pt">Conteúdo (PT)</Label>
                  <textarea
                    id="news-content-pt"
                    className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    maxLength={10000}
                    required
                  />
                </div>
              </TabsContent>
              <TabsContent value="en" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="news-title-en">Title (EN)</Label>
                  <Input
                    id="news-title-en"
                    value={form.title_en}
                    onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="news-content-en">Content (EN)</Label>
                  <textarea
                    id="news-content-en"
                    className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.content_en}
                    onChange={(e) => setForm((f) => ({ ...f, content_en: e.target.value }))}
                    maxLength={10000}
                    required
                  />
                </div>
              </TabsContent>
            </Tabs>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.published}
                onChange={(e) =>
                  setForm((f) => ({ ...f, published: e.target.checked }))
                }
              />
              Publicar na homepage
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveNews()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  A guardar...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
