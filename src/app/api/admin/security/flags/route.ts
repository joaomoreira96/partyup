import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/services/auth.service";
import { resolveUserFlag } from "@/services/admin-security.service";

const schema = z.object({
  flagId: z.string().uuid(),
});

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const result = await resolveUserFlag(parsed.data.flagId);
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
