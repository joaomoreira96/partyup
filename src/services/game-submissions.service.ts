import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  getGameBuildsPublicUrl,
  isServiceClientConfigured,
} from "@/lib/supabase/service";
import {
  mimeForPackagePath,
  validateGamePackageZip,
} from "@/lib/game-submissions/package-validator";
import {
  isAdmin,
  isDeveloperOrAdmin,
  getSessionUser,
} from "@/services/auth.service";
import type { GameSubmission, SubmissionStatus } from "@/types/platform";

const BUCKET = "game-builds";

function normalizePublishPayload(
  data: unknown
): { game_id?: string; slug?: string } | null {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return normalizePublishPayload(JSON.parse(data));
    } catch {
      return null;
    }
  }
  if (typeof data === "object") {
    const row = data as Record<string, unknown>;
    const gameId = row.game_id ?? row.gameId;
    const slug = row.slug;
    return {
      game_id: gameId != null ? String(gameId) : undefined,
      slug: slug != null ? String(slug) : undefined,
    };
  }
  return null;
}

export type GameSubmissionRow = GameSubmission & {
  submitter_display_name?: string | null;
};

function mapSubmissionRow(row: Record<string, unknown>): GameSubmission {
  return row as unknown as GameSubmission;
}

export async function listGameSubmissions(): Promise<GameSubmissionRow[]> {
  if (!(await isDeveloperOrAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data.map(mapSubmissionRow);
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  if (userIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.display_name || p.username || null,
    ])
  );

  return rows.map((row) => ({
    ...row,
    submitter_display_name: nameById.get(row.user_id) ?? null,
  }));
}

export async function submitGamePackage(
  zipBuffer: Buffer
): Promise<
  { ok: true; submission: GameSubmission } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "forbidden" };
  }

  if (!(await isDeveloperOrAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  if (!isServiceClientConfigured()) {
    return { ok: false, error: "storage_not_configured" };
  }

  const validated = await validateGamePackageZip(zipBuffer);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const { manifest, files, storagePrefix, checksum, totalBytes } =
    validated.data;

  const supabase = await createClient();

  const { data: nativeConflict } = await supabase
    .from("games")
    .select("id, runtime")
    .eq("slug", manifest.slug)
    .maybeSingle();

  if (
    nativeConflict &&
    (nativeConflict.runtime === "native" || !nativeConflict.runtime)
  ) {
    return {
      ok: false,
      error: `O slug "${manifest.slug}" já está reservado por um jogo nativo da plataforma.`,
    };
  }

  const { data: existingSubmission } = await supabase
    .from("game_submissions")
    .select("id, status")
    .eq("slug", manifest.slug)
    .eq("version", manifest.version)
    .maybeSingle();

  if (existingSubmission) {
    return {
      ok: false,
      error: `Já existe uma submissão para ${manifest.slug} v${manifest.version} (${existingSubmission.status}).`,
    };
  }

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "storage_not_configured" };
  }

  const uploadedPaths: string[] = [];

  try {
    for (const [relativePath, content] of files.entries()) {
      const objectPath = `${storagePrefix}/${relativePath}`;
      const { error: uploadError } = await service.storage
        .from(BUCKET)
        .upload(objectPath, content, {
          contentType: mimeForPackagePath(relativePath),
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`upload_failed:${relativePath}:${uploadError.message}`);
      }

      uploadedPaths.push(objectPath);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("game_submissions")
      .insert({
        user_id: user.id,
        game_name: manifest.name,
        slug: manifest.slug,
        version: manifest.version,
        sdk_version: manifest.sdkVersion,
        manifest: {
          ...manifest,
          _platform: { uploadedPaths: [...files.keys()] },
        },
        storage_path: storagePrefix,
        size_bytes: totalBytes,
        checksum,
        status: "pending" satisfies SubmissionStatus,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "insert_failed");
    }

    return { ok: true, submission: mapSubmissionRow(inserted) };
  } catch (err) {
    if (uploadedPaths.length > 0) {
      await service.storage.from(BUCKET).remove(uploadedPaths);
    }

    const message = err instanceof Error ? err.message : "submit_failed";
    return {
      ok: false,
      error: message.startsWith("upload_failed:")
        ? "Falha ao enviar ficheiros para o storage."
        : message,
    };
  }
}

export async function reviewGameSubmission(
  submissionId: string,
  action: "approve" | "reject",
  notes?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_submission", {
    p_id: submissionId,
    p_action: action,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("submission_not_found")) {
      return { ok: false, error: "submission_not_found" };
    }
    if (msg.includes("invalid_action")) {
      return { ok: false, error: "invalid_action" };
    }
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "review_failed" };
  }

  return { ok: true };
}

export async function publishGameSubmission(
  submissionId: string
): Promise<
  { ok: true; gameId: string; slug: string } | { ok: false; error: string }
> {
  if (!(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data: submission, error: fetchError } = await supabase
    .from("game_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError || !submission) {
    return { ok: false, error: "submission_not_found" };
  }

  if (submission.status !== "approved") {
    return { ok: false, error: "submission_not_approved" };
  }

  const prefix = String(submission.storage_path).replace(/\/+$/, "");
  const thumbnailUrl = getGameBuildsPublicUrl(`${prefix}/thumbnail.png`);
  const bannerUrl = getGameBuildsPublicUrl(`${prefix}/banner.png`);
  const buildUrl = `${prefix}/build/index.html`;

  const { data, error } = await supabase.rpc("admin_publish_submission", {
    p_id: submissionId,
    p_thumbnail_url: thumbnailUrl,
    p_banner_url: bannerUrl,
    p_build_url: buildUrl,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("slug_conflict_native")) {
      return {
        ok: false,
        error: "slug_conflict_native",
      };
    }
    if (msg.includes("submission_not_approved")) {
      return { ok: false, error: "submission_not_approved" };
    }
    if (msg.includes("submission_not_found")) {
      return { ok: false, error: "submission_not_found" };
    }
    return { ok: false, error: error.message };
  }

  const payload = normalizePublishPayload(data);
  if (!payload?.game_id) {
    return { ok: false, error: "publish_failed" };
  }

  return {
    ok: true,
    gameId: String(payload.game_id),
    slug: String(payload.slug ?? submission.slug),
  };
}

export async function deleteGameSubmission(
  submissionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("game_submissions")
    .select("id, storage_path, status, manifest")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return { ok: false, error: "submission_not_found" };
  }

  if (submission.status === "published") {
    return { ok: false, error: "cannot_delete_published" };
  }

  const { error } = await supabase
    .from("game_submissions")
    .delete()
    .eq("id", submissionId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (isServiceClientConfigured()) {
    const service = createServiceClient();
    const prefix = String(submission.storage_path).replace(/\/+$/, "");
    const manifest = submission.manifest as {
      _platform?: { uploadedPaths?: string[] };
    };
    const relativePaths = manifest._platform?.uploadedPaths ?? [];

    if (relativePaths.length > 0) {
      const paths = relativePaths.map((p) => `${prefix}/${p}`);
      await service!.storage.from(BUCKET).remove(paths);
    }
  }

  return { ok: true };
}
