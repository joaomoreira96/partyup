export const SITE_NAME = "PartyUp";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_DESCRIPTION =
  "Plataforma social de jogos no browser. Entra, joga, partilha e compete — sem instalar nada.";

export const NAV_LINKS = [
  { href: "/games", key: "nav.games" },
  { href: "/rankings", key: "nav.rankings" },
  { href: "/profile", key: "nav.profile" },
] as const;
