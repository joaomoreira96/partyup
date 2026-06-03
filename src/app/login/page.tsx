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

export default async function LoginPage() {
  const { t } = await getServerI18n();

  return (
    <MainShell className="max-w-md">
      <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
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
