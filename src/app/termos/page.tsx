import { MainShell } from "@/components/layout/main-shell";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Termos de Utilização",
  path: "/termos",
});

export default function TermsPage() {
  return (
    <MainShell className="max-w-2xl prose prose-sm dark:prose-invert">
      <h1>Termos de Utilização</h1>
      <p className="text-muted-foreground">
        Documento em preparação. Ao utilizar o PartyUp aceitas jogar de forma
        respeitosa e seguir as regras de cada jogo.
      </p>
    </MainShell>
  );
}
