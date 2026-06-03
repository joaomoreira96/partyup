const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function resolveAvatarFile(file: File):
  | { ok: true; mime: string; ext: string }
  | { ok: false; message: string } {
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, message: "A imagem deve ter no máximo 2 MB." };
  }

  let mime = file.type;
  if (!mime || !ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    mime = EXT_TO_MIME[ext] ?? "";
  }

  if (!mime || !ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    return {
      ok: false,
      message: "Formato não suportado. Usa JPG, PNG, WebP ou GIF.",
    };
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";

  return { ok: true, mime, ext };
}

export function mapStorageUploadError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket") && m.includes("not found")) {
    return "Bucket de avatares em falta. Aplica as migrações Supabase (storage).";
  }
  if (m.includes("row-level security") || m.includes("policy")) {
    return "Sem permissão para enviar. Sai e volta a entrar na conta.";
  }
  if (m.includes("mime") || m.includes("content-type")) {
    return "Formato de imagem não permitido no servidor.";
  }
  if (m.includes("maximum") || m.includes("size") || m.includes("too large")) {
    return "A imagem deve ter no máximo 2 MB.";
  }
  return "Não foi possível enviar a imagem.";
}
