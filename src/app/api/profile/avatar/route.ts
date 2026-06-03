import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { updateProfile } from "@/services/profile.service";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  mapStorageUploadError,
  resolveAvatarFile,
} from "@/lib/profile/avatar-file";

/**
 * Preferir upload no cliente (browser) com sessão Supabase — mais fiável.
 * Esta rota mantém fallback servidor + PATCH só de avatar_url após upload cliente.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Sessão expirada." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "Serviço indisponível." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { avatar_url?: string };
    if (!body.avatar_url) {
      return NextResponse.json({ message: "URL do avatar em falta." }, { status: 400 });
    }

    const result = await updateProfile(user.id, {
      avatar_url: body.avatar_url,
    });

    if (!result.ok) {
      return NextResponse.json(
        { message: "Imagem enviada mas o perfil não foi atualizado." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, avatar_url: body.avatar_url });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Ficheiro em falta." }, { status: 400 });
  }

  const resolved = resolveAvatarFile(file);
  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: 400 });
  }

  const path = `${user.id}/avatar.${resolved.ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = await createClient();

  await supabase.storage.from("avatars").remove([path]);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: resolved.mime,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        message: mapStorageUploadError(uploadError.message),
        detail:
          process.env.NODE_ENV === "development" ? uploadError.message : undefined,
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const cacheBusted = `${publicUrl}?v=${Date.now()}`;
  const result = await updateProfile(user.id, { avatar_url: cacheBusted });

  if (!result.ok) {
    return NextResponse.json(
      { message: "Imagem enviada mas o perfil não foi atualizado." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, avatar_url: cacheBusted });
}
