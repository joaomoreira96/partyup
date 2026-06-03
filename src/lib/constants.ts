export const SITE_NAME = "PartyUp";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_DESCRIPTION =
  "Plataforma social de jogos no browser. Entra, joga, partilha e compete — sem instalar nada.";

/** Slugs destacados na home — adicionar jogos sem alterar navegação */
export const FEATURED_GAME_SLUGS = [
  "memoria-classica",
  "reacao-rapida",
  "trivia-rapida",
] as const;

export const NAV_LINKS = [
  { href: "/games", label: "Jogos" },
  { href: "/rankings", label: "Rankings" },
  { href: "/profile", label: "Perfil" },
] as const;
