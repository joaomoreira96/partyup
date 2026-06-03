import { MainShell } from "@/components/layout/main-shell";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Política de Privacidade",
  path: "/privacidade",
});

export default function PrivacyPage() {
  return (
    <MainShell className="max-w-2xl prose prose-sm dark:prose-invert">
      <h1>Política de Privacidade</h1>
      <p className="text-muted-foreground">
        Documento em preparação. O PartyUp recolhe apenas dados necessários
        para conta, rankings e estatísticas de jogo.
      </p>
    </MainShell>
  );
}
