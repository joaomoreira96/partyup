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
    const message =
      result.error === "slug_taken"
        ? "Este slug já existe."
        : result.error === "name_required"
          ? "Indica o nome da categoria."
          : "Não foi possível criar a categoria.";
    return NextResponse.json({ message }, { status: 400 });
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
