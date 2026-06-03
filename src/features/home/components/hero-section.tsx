import Link from "next/link";
import { Play, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="party-card-premium relative overflow-hidden border border-border/60 p-6 sm:p-10 lg:p-12"
    >
      <div
        className="party-gradient-hero pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="relative z-10 max-w-2xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
          <Sparkles className="size-3.5 text-accent" aria-hidden />
          Joga no browser — sem instalar
        </p>
        <h1
          id="hero-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight"
        >
          Entrar. Jogar. Partilhar. Competir.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          PartyUp é a tua plataforma social de jogos. Experimenta grátis,
          convida amigos e compete em rankings — tudo no browser.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" className="h-11 px-6" asChild>
            <Link href="/games/memoria-classica/play">
              <Play className="size-4" aria-hidden />
              Jogar agora
            </Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-11 px-6" asChild>
            <Link href="/games">Explorar jogos</Link>
          </Button>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0 text-secondary" aria-hidden />
          Multiplayer por link — sem fricção
        </p>
      </div>
    </section>
  );
}
