import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerI18n } from "@/i18n/get-server-i18n";

export default async function NotFound() {
  const { t } = await getServerI18n();

  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center"
    >
      <h1 className="text-4xl font-bold">{t("errors.notFoundTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("errors.notFoundDescription")}</p>
      <Button className="mt-8" asChild>
        <Link href="/">{t("errors.notFoundCta")}</Link>
      </Button>
    </main>
  );
}
