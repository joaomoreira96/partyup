import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

function revalidateHomeNews() {
  revalidatePath("/");
}
import {
  createNews,
  deleteNews,
  listNewsForAdmin,
  updateNews,
} from "@/services/news.service";
import { isAdmin } from "@/services/auth.service";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }
  const news = await listNewsForAdmin();
  return NextResponse.json({ news });
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().min(1).max(48).optional(),
  content: z.string().min(1).max(10000),
  published: z.boolean().default(false),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await createNews({
    ...parsed.data,
    published: parsed.data.published === true,
  });
  if (!result.ok) {
    const message =
      result.error === "title_required"
        ? "Indica o título."
        : result.error === "content_required"
          ? "Indica o conteúdo."
          : result.error === "slug_taken"
            ? "Este slug já existe."
            : "Não foi possível criar a news.";
    return NextResponse.json({ message }, { status: 400 });
  }

  revalidateHomeNews();
  return NextResponse.json({ item: result.item });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const result = await updateNews(id, {
    ...updates,
    ...(updates.published !== undefined
      ? { published: updates.published === true }
      : {}),
  });
  if (!result.ok) {
    const message =
      result.error === "not_found"
        ? "News não encontrada."
        : result.error === "slug_taken"
          ? "Este slug já existe."
          : "Não foi possível atualizar a news.";
    return NextResponse.json({ message }, { status: 400 });
  }

  revalidateHomeNews();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await deleteNews(parsed.data.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        message:
          result.error === "not_found" ? "News não encontrada." : "Não foi possível apagar.",
      },
      { status: 400 }
    );
  }

  revalidateHomeNews();
  return NextResponse.json({ ok: true });
}
