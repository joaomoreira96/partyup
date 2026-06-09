"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  Loader2,
  Package,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GameSubmissionRow } from "@/services/game-submissions.service";
import type { SubmissionStatus } from "@/types/platform";
import { cn } from "@/lib/utils";

type GameSubmissionsManagerProps = {
  initialSubmissions: GameSubmissionRow[];
  isAdmin: boolean;
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  published: "Publicada",
};

const STATUS_VARIANT: Record<
  SubmissionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  approved: "outline",
  rejected: "destructive",
  published: "default",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GameSubmissionsManager({
  initialSubmissions,
  isAdmin,
}: GameSubmissionsManagerProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] =
    useState<GameSubmissionRow[]>(initialSubmissions);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/game-submissions");
    if (!res.ok) return;
    const data = (await res.json()) as { submissions: GameSubmissionRow[] };
    setSubmissions(data.submissions ?? []);
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Seleciona um ficheiro ZIP.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("package", file);

      const res = await fetch("/api/admin/game-submissions", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        toast.error(data.message ?? "Upload falhou.");
        return;
      }

      toast.success("Pacote submetido. Aguarda revisão.");
      if (fileRef.current) fileRef.current.value = "";
      await reload();
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setUploading(false);
    }
  }

  async function review(
    submissionId: string,
    action: "approve" | "reject"
  ) {
    setBusyId(submissionId);
    try {
      const res = await fetch("/api/admin/game-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action,
          notes: reviewNotes[submissionId]?.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Ação falhou.");
        return;
      }
      toast.success(action === "approve" ? "Submissão aprovada." : "Submissão rejeitada.");
      await reload();
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(submissionId: string) {
    setBusyId(submissionId);
    try {
      const res = await fetch("/api/admin/game-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, action: "publish" }),
      });
      const data = (await res.json()) as {
        message?: string;
        detail?: string;
        slug?: string;
      };
      if (!res.ok) {
        const hint =
          data.detail && data.detail !== data.message
            ? ` (${data.detail})`
            : "";
        toast.error((data.message ?? "Publicação falhou.") + hint);
        return;
      }
      toast.success("Jogo publicado no catálogo.");
      await reload();
      router.refresh();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(submissionId: string) {
    if (!window.confirm("Apagar esta submissão e os ficheiros do storage?")) return;

    setBusyId(submissionId);
    try {
      const res = await fetch("/api/admin/game-submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Não foi possível apagar.");
        return;
      }
      toast.success("Submissão removida.");
      await reload();
    } catch {
      toast.error("Erro de ligação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-lg border p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Submeter pacote ZIP</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              O pacote deve incluir manifest.json, thumbnail.png, banner.png e
              build/index.html. Máximo 50 MB. Sem ficheiros SQL.
            </p>
            <form onSubmit={(e) => void handleUpload(e)} className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="game-package">game-package.zip</Label>
                <Input
                  ref={fileRef}
                  id="game-package"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={uploading}
                />
              </div>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                {uploading ? "A enviar…" : "Enviar submissão"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Submissões</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Revisa, aprova e publica jogos no catálogo."
                : "As tuas submissões aparecem aqui."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Atualizar
          </Button>
        </div>

        {submissions.length === 0 ? (
          <p className="mt-4 rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
            Ainda não há submissões.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {submissions.map((sub) => {
              const busy = busyId === sub.id;
              return (
                <li
                  key={sub.id}
                  className={cn(
                    "rounded-lg border p-4",
                    sub.status === "rejected" && "opacity-80"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sub.game_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.slug} · v{sub.version} · SDK {sub.sdk_version}
                      </p>
                      {sub.submitter_display_name && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Por {sub.submitter_display_name}
                        </p>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[sub.status]}>
                      {STATUS_LABELS[sub.status]}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="inline">Tamanho: </dt>
                      <dd className="inline">{formatBytes(Number(sub.size_bytes))}</dd>
                    </div>
                    <div>
                      <dt className="inline">Enviado: </dt>
                      <dd className="inline">
                        {new Date(sub.created_at).toLocaleString("pt-PT")}
                      </dd>
                    </div>
                  </dl>

                  {sub.review_notes && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Notas: {sub.review_notes}
                    </p>
                  )}

                  {sub.status === "published" && sub.published_game_id && (
                    <Button variant="link" className="mt-2 h-auto p-0" asChild>
                      <Link href={`/games/${sub.slug}`}>
                        Ver no catálogo
                        <ExternalLink className="ml-1 size-3.5" aria-hidden />
                      </Link>
                    </Button>
                  )}

                  {isAdmin && sub.status !== "published" && (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`notes-${sub.id}`} className="text-xs">
                        Notas de revisão (opcional)
                      </Label>
                      <Input
                        id={`notes-${sub.id}`}
                        value={reviewNotes[sub.id] ?? ""}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        placeholder="Motivo da rejeição ou comentários internos"
                        disabled={busy}
                      />
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sub.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void review(sub.id, "approve")}
                          >
                            {busy ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <Check className="size-4" aria-hidden />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void review(sub.id, "reject")}
                          >
                            <X className="size-4" aria-hidden />
                            Rejeitar
                          </Button>
                        </>
                      )}

                      {sub.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void publish(sub.id)}
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Upload className="size-4" aria-hidden />
                          )}
                          Publicar no catálogo
                        </Button>
                      )}

                      {sub.status !== "published" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void remove(sub.id)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                          Apagar
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
