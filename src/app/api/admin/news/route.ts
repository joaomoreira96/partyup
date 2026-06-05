import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createNews,
  deleteNews,
  listNewsForAdmin,
  updateNews,
} from "@/services/news.service";
import { isAdmin } from "@/services/auth.service";

function revalidateHomeNews() {
  revalidatePath("/");
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }
  const news = await listNewsForAdmin();
  return NextResponse.json({ news });
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  title_en: z.string().min(1).max(120),
  slug: z.string().min(1).max(48).optional(),
  content: z.string().min(1).max(10000),
  content_en: z.string().min(1).max(10000),
  published: z.boolean().default(false),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

const errorMessages: Record<string, string> = {
  title_required: "Indica o título em português.",
  title_en_required: "Indica o título em inglês.",
  content_required: "Indica o conteúdo em português.",
  content_en_required: "Indica o conteúdo em inglês.",
  slug_taken: "Este slug já existe.",
};

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
    return NextResponse.json(
      { message: errorMessages[result.error] ?? "Não foi possível criar a news." },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        message:
          result.error === "not_found"
            ? "News não encontrada."
            : (errorMessages[result.error] ?? "Não foi possível atualizar a news."),
      },
      { status: 400 }
    );
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
