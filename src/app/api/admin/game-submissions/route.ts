import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, isDeveloperOrAdmin } from "@/services/auth.service";
import {
  deleteGameSubmission,
  listGameSubmissions,
  publishGameSubmission,
  reviewGameSubmission,
  submitGamePackage,
} from "@/services/game-submissions.service";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 52_428_800;

export async function GET() {
  if (!(await isDeveloperOrAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const submissions = await listGameSubmissions();
  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  if (!(await isDeveloperOrAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  const file = formData.get("package");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Envia um ficheiro ZIP no campo package." },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { message: "O ficheiro deve ser um ZIP (.zip)." },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { message: "Pacote excede o limite de 50 MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await submitGamePackage(buffer);

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "storage_not_configured"
          ? 503
          : 400;

    const messages: Record<string, string> = {
      forbidden: "Acesso negado.",
      storage_not_configured:
        "Storage não configurado. Define SUPABASE_SERVICE_ROLE_KEY no servidor.",
    };

    return NextResponse.json(
      {
        message: messages[result.error] ?? result.error,
        detail:
          process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status }
    );
  }

  return NextResponse.json({ ok: true, submission: result.submission });
}

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);

  const publishOnly =
    body &&
    typeof body === "object" &&
    "action" in body &&
    (body as { action?: string }).action === "publish";

  if (publishOnly) {
    if (!(await isAdmin())) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    const parsed = z
      .object({ submissionId: z.string().uuid(), action: z.literal("publish") })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const result = await publishGameSubmission(parsed.data.submissionId);
    if (!result.ok) {
      const messages: Record<string, string> = {
        forbidden: "Acesso negado.",
        submission_not_found: "Submissão não encontrada.",
        submission_not_approved: "A submissão tem de estar aprovada antes de publicar.",
        slug_conflict_native:
          "Este slug pertence a um jogo nativo da plataforma e não pode ser publicado.",
        publish_failed: "Não foi possível publicar o jogo.",
      };

      return NextResponse.json(
        {
          message: messages[result.error] ?? "Não foi possível publicar.",
          detail: result.error,
        },
        { status: 400 }
      );
    }

    revalidatePath("/games");
    revalidatePath(`/games/${result.slug}`);

    return NextResponse.json({
      ok: true,
      gameId: result.gameId,
      slug: result.slug,
    });
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await reviewGameSubmission(
    parsed.data.submissionId,
    parsed.data.action,
    parsed.data.notes
  );

  if (!result.ok) {
    const messages: Record<string, string> = {
      forbidden: "Acesso negado.",
      submission_not_found: "Submissão não encontrada.",
      invalid_action: "Ação inválida.",
    };

    return NextResponse.json(
      {
        message: messages[result.error] ?? "Não foi possível rever a submissão.",
        detail:
          process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = z.object({ submissionId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await deleteGameSubmission(parsed.data.submissionId);
  if (!result.ok) {
    const messages: Record<string, string> = {
      forbidden: "Acesso negado.",
      submission_not_found: "Submissão não encontrada.",
      cannot_delete_published: "Não é possível apagar submissões já publicadas.",
    };

    return NextResponse.json(
      {
        message: messages[result.error] ?? "Não foi possível apagar.",
        detail:
          process.env.NODE_ENV === "development" ? result.error : undefined,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
