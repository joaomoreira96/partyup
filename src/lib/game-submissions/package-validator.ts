import JSZip from "jszip";
import { createHash } from "node:crypto";
import {
  MAX_PACKAGE_BYTES,
  REQUIRED_PACKAGE_FILES,
  parseGameManifest,
  type ParsedGameManifest,
} from "@/lib/game-submissions/manifest-schema";

const FORBIDDEN_EXTENSIONS = new Set([
  ".sql",
  ".ddl",
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".php",
  ".py",
  ".rb",
  ".jar",
  ".dll",
  ".so",
  ".dylib",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".mp3",
  ".wav",
  ".ogg",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".txt",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".map",
  ".wasm",
]);

const FORBIDDEN_PATH_RE =
  /(^|\/)(migrations|__MACOSX|node_modules|\.git)(\/|$)|\.DS_Store$/i;

export type ValidatedGamePackage = {
  manifest: ParsedGameManifest;
  files: Map<string, Buffer>;
  storagePrefix: string;
  checksum: string;
  totalBytes: number;
};

function normalizeEntryPath(raw: string): string | null {
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) return null;

  const segments = normalized.split("/");
  if (segments.some((s) => s === ".." || s === ".")) return null;

  return normalized;
}

function extensionOf(path: string): string {
  const idx = path.lastIndexOf(".");
  if (idx <= 0) return "";
  return path.slice(idx).toLowerCase();
}

function isPathAllowed(path: string): string | null {
  if (FORBIDDEN_PATH_RE.test(path)) {
    return "O pacote contém caminhos proibidos.";
  }

  const ext = extensionOf(path);
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return `Ficheiro proibido: ${path}`;
  }

  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return `Extensão não permitida (${ext}): ${path}`;
  }

  return null;
}

export async function validateGamePackageZip(
  zipBuffer: Buffer
): Promise<
  { ok: true; data: ValidatedGamePackage } | { ok: false; error: string }
> {
  if (zipBuffer.byteLength > MAX_PACKAGE_BYTES) {
    return { ok: false, error: "Pacote excede o limite de 50 MB." };
  }

  if (zipBuffer.byteLength < 64) {
    return { ok: false, error: "Pacote ZIP inválido ou vazio." };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return { ok: false, error: "Não foi possível ler o ficheiro ZIP." };
  }

  const files = new Map<string, Buffer>();
  let totalBytes = 0;

  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const path = normalizeEntryPath(rawPath);
    if (!path) {
      return { ok: false, error: `Caminho inválido no ZIP: ${rawPath}` };
    }

    const pathError = isPathAllowed(path);
    if (pathError) {
      return { ok: false, error: pathError };
    }

    const content = Buffer.from(await entry.async("arraybuffer"));
    totalBytes += content.byteLength;

    if (totalBytes > MAX_PACKAGE_BYTES) {
      return {
        ok: false,
        error: "Conteúdo descomprimido excede o limite de 50 MB.",
      };
    }

    files.set(path, content);
  }

  for (const required of REQUIRED_PACKAGE_FILES) {
    if (!files.has(required)) {
      return { ok: false, error: `Ficheiro obrigatório em falta: ${required}` };
    }
  }

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(files.get("manifest.json")!.toString("utf8"));
  } catch {
    return { ok: false, error: "manifest.json não é JSON válido." };
  }

  const manifestResult = parseGameManifest(manifestRaw);
  if (!manifestResult.ok) {
    return { ok: false, error: manifestResult.error };
  }

  const manifest = manifestResult.data;
  const storagePrefix = `${manifest.slug}/${manifest.version}`;

  const checksum = createHash("sha256").update(zipBuffer).digest("hex");

  return {
    ok: true,
    data: {
      manifest,
      files,
      storagePrefix,
      checksum,
      totalBytes: zipBuffer.byteLength,
    },
  };
}

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

export function mimeForPackagePath(path: string): string {
  const ext = extensionOf(path);
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}
