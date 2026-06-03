import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-4 text-muted-foreground">Página ou jogo não encontrado.</p>
      <Button className="mt-8" asChild>
        <Link href="/">Voltar ao catálogo</Link>
      </Button>
    </main>
  );
}
