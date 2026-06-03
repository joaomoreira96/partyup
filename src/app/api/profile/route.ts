import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/services/auth.service";
import {
  ensureProfileForUser,
  isUsernameAvailable,
  updateProfile,
} from "@/services/profile.service";
import { mapProfileSaveError } from "@/lib/profile/errors";
import { normalizeUsername, validateUsername } from "@/lib/profile/username";

const patchSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  username: z.string().min(3).max(20).optional(),
  avatar_url: z
    .union([z.string().url().max(2048), z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  bio: z.string().max(280).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  public_profile: z.boolean().optional(),
  show_activity: z.boolean().optional(),
  show_country: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Sessão expirada." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        message: first?.message ?? "Dados inválidos.",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const updates: Parameters<typeof updateProfile>[1] = {};

  if (parsed.data.display_name !== undefined) {
    updates.display_name = parsed.data.display_name.trim();
  }

  if (parsed.data.username !== undefined) {
    const username = normalizeUsername(parsed.data.username);
    const check = validateUsername(username);
    if (!check.ok) {
      return NextResponse.json({ message: check.message }, { status: 400 });
    }

    const available = await isUsernameAvailable(username, user.id);
    if (!available) {
      return NextResponse.json(
        { message: "Esta tag já está a ser usada. Escolhe outra." },
        { status: 409 }
      );
    }
    updates.username = username;
  }

  if (parsed.data.avatar_url !== undefined) {
    updates.avatar_url = parsed.data.avatar_url;
  }

  if (parsed.data.bio !== undefined) {
    updates.bio = parsed.data.bio;
  }

  if (parsed.data.country !== undefined) {
    updates.country = parsed.data.country;
  }

  if (parsed.data.public_profile !== undefined) {
    updates.public_profile = parsed.data.public_profile;
  }
  if (parsed.data.show_activity !== undefined) {
    updates.show_activity = parsed.data.show_activity;
  }
  if (parsed.data.show_country !== undefined) {
    updates.show_country = parsed.data.show_country;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Nada para atualizar." }, { status: 400 });
  }

  const ensured = await ensureProfileForUser(user);
  if (!ensured.ok) {
    return NextResponse.json(
      {
        message: mapProfileSaveError(ensured.error, ensured.code),
      },
      { status: 500 }
    );
  }

  let result = await updateProfile(user.id, updates);

  if (!result.ok && result.error === "profile_not_found") {
    await ensureProfileForUser(user);
    result = await updateProfile(user.id, updates);
  }

  if (!result.ok) {
    const status =
      result.code === "23505" || result.error?.includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        message: mapProfileSaveError(result.error, result.code),
        detail: process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status }
    );
  }

  if (updates.display_name) {
    const supabase = await createClient();
    await supabase.auth.updateUser({
      data: { display_name: updates.display_name },
    });
  }

  return NextResponse.json({ ok: true, updates });
}
