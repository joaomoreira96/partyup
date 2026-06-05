import Link from "next/link";
import { MainShell } from "@/components/layout/main-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getServerI18n } from "@/i18n/get-server-i18n";

export async function generateMetadata() {
  const { t } = await getServerI18n();
  return buildPageMetadata({
    title: t("auth.resetPassword.title"),
    path: "/reset-password",
    noIndex: true,
  });
}

export default async function ResetPasswordPage() {
  const { t } = await getServerI18n();

  return (
    <MainShell className="max-w-md">
      <h1 className="text-2xl font-bold">{t("auth.resetPassword.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.resetPassword.subtitle")}</p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline">
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </p>
    </MainShell>
  );
}
