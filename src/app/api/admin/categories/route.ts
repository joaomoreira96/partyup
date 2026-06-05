import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCategory,
  deleteCategory,
  listCategoriesForAdmin,
  updateCategory,
} from "@/services/category-admin.service";
import { isAdmin } from "@/services/auth.service";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }
  const categories = await listCategoriesForAdmin();
  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(48).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(48).optional(),
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

  const result = await createCategory(parsed.data);
  if (!result.ok) {
    const messages: Record<string, string> = {
      slug_taken: "Este slug já existe.",
      name_required: "Indica o nome da categoria.",
      slug_required: "Slug inválido.",
      forbidden: "Sem permissão de admin. Confirma que o teu perfil tem role = admin.",
      rpc_not_found:
        "Função admin_create_category não encontrada. Volta a executar a migration e recarrega o schema do Supabase.",
    };
    const message =
      messages[result.error] ??
      (result.error.startsWith("create_failed:")
        ? "A categoria foi criada mas a resposta foi inesperada. Recarrega a página."
        : result.error.includes(" ")
          ? result.error
          : "Não foi possível criar a categoria.");
    return NextResponse.json(
      {
        message,
        detail: result.error,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ category: result.category });
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

  const result = await updateCategory(parsed.data.id, parsed.data);
  if (!result.ok) {
    const message =
      result.error === "slug_taken"
        ? "Este slug já existe."
        : result.error === "not_found"
          ? "Categoria não encontrada."
          : "Não foi possível atualizar a categoria.";
    return NextResponse.json({ message }, { status: 400 });
  }

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

  const result = await deleteCategory(parsed.data.id);
  if (!result.ok) {
    return NextResponse.json(
      { message: result.error === "not_found" ? "Categoria não encontrada." : "Não foi possível apagar." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
