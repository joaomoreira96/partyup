import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { AuthForm } from "@/features/auth/components/auth-form";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Entrar",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <MainShell className="max-w-md">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Opcional para jogar — necessário para rankings e conquistas.
      </p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sem conta?{" "}
        <Link href="/register" className="font-medium text-primary underline">
          Registar
        </Link>
      </p>
    </MainShell>
  );
}
