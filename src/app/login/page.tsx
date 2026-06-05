import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { AuthForm } from "@/features/auth/components/auth-form";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("auth.loginTitle"),
    path: "/login",
    noIndex: true,
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { t } = await getServerI18n();
  const params = await searchParams;
  const resetSuccess = params.reset === "success";
  const authCallbackError = params.error === "auth_callback";

  return (
    <MainShell className="max-w-md">
      <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
      {resetSuccess && (
        <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {t("auth.resetPassword.success")}
        </p>
      )}
      {authCallbackError && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("auth.resetPassword.invalidLink")}
        </p>
      )}
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary underline">
          {t("auth.registerLink")}
        </Link>
      </p>
    </MainShell>
  );
}
