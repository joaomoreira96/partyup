import { z } from "zod";

export const SUPPORTED_SDK_VERSIONS = ["1.0"] as const;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const MAX_PACKAGE_BYTES = 52_428_800; // 50 MB

export const REQUIRED_PACKAGE_FILES = [
  "manifest.json",
  "thumbnail.png",
  "banner.png",
  "build/index.html",
] as const;

const achievementSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  icon: z.string().max(64).nullable().optional(),
});

export const gameManifestSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: z.string().regex(SLUG_RE, "slug inválido"),
    version: z.string().regex(SEMVER_RE, "versão semver inválida"),
    author: z.string().min(1).max(120),
    description: z.string().max(2000).optional().default(""),
    sdkVersion: z.string().min(1).max(20),
    minPlayers: z.number().int().min(1).max(64),
    maxPlayers: z.number().int().min(1).max(64),
    supportsDesktop: z.boolean(),
    supportsTablet: z.boolean(),
    supportsMobile: z.boolean(),
    categories: z.array(z.string().regex(SLUG_RE)).max(10).optional(),
    tags: z.array(z.string().regex(SLUG_RE)).max(20).optional(),
    achievements: z.array(achievementSchema).max(50).optional(),
  })
  .refine((data) => data.maxPlayers >= data.minPlayers, {
    message: "maxPlayers deve ser >= minPlayers",
    path: ["maxPlayers"],
  })
  .refine((data) => SUPPORTED_SDK_VERSIONS.includes(data.sdkVersion as "1.0"), {
    message: "sdkVersion não suportada",
    path: ["sdkVersion"],
  });

export type ParsedGameManifest = z.infer<typeof gameManifestSchema>;

export function parseGameManifest(raw: unknown):
  | { ok: true; data: ParsedGameManifest }
  | { ok: false; error: string } {
  const parsed = gameManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "manifest inválido",
    };
  }
  return { ok: true, data: parsed.data };
}
