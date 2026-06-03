import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

const LUMICORE_URL = "https://lumicorestudio.pt";
const LUMICORE_LOGO = "/LumicoreStudioSuperMinimalistLogo.png";

const FOOTER_LINKS = [
  { href: "/games", label: "Jogos" },
  { href: "/rankings", label: "Rankings" },
  { href: "/login", label: "Entrar" },
  { href: "/register", label: "Registar" },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:max-w-7xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-lg font-bold">{SITE_NAME}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Plataforma social de jogos. Diversão, amigos e competição saudável
              — direto no browser.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Explorar</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Legal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacidade"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  Termos de Utilização
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Comunidade</h2>
            <p className="mt-3 text-sm text-muted-foreground">Discord — em breve</p>
          </div>
        </div>
        <div className="relative mt-10 flex flex-col items-center gap-6 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-center text-xs text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} {SITE_NAME}. Todos os direitos reservados.
          </span>

          <a
            href={LUMICORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visitar Lumicore Studio (abre numa nova janela)"
            className="group flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground sm:absolute sm:left-1/2 sm:-translate-x-1/2"
          >
            <span className="whitespace-nowrap text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              Powered by
            </span>

            <div className="flex flex-col items-center">
              <Image
                src={LUMICORE_LOGO}
                alt="Lumicore Studio"
                width={120}
                height={120}
                className="h-7 w-auto object-contain opacity-80 transition-opacity group-hover:opacity-100"
              />
              <span className="mt-1 text-[7px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
                Lumicore Studio
              </span>
            </div>
          </a>
        </div>
      </div>
    </footer>
  );
}
