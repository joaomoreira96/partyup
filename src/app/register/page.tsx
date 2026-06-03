import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { AuthForm } from "@/features/auth/components/auth-form";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Registar",
  path: "/register",
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <MainShell className="max-w-md">
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Guarda progresso, entra nos rankings e desbloqueia conquistas.
      </p>
      <div className="mt-8">
        <AuthForm mode="register" />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tens conta?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Entrar
        </Link>
      </p>
    </MainShell>
  );
}
