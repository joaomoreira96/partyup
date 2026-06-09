import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { getGameName, getGameDescription, type LocalizedGameName } from "@/lib/game-localized";

type PageMetaInput = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "",
  image = "/games/placeholder-banner.svg",
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website",
      locale: "pt_PT",
      url,
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      images: [{ url: image.startsWith("http") ? image : `${SITE_URL}${image}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.startsWith("http") ? image : `${SITE_URL}${image}`],
    },
  };
}

export function buildGameMetadata(
  game: LocalizedGameName & {
    description: string;
    description_en?: string | null;
    slug: string;
    banner_url?: string | null;
    thumbnail_url?: string | null;
  },
  locale: Locale = "pt"
): Metadata {
  return buildPageMetadata({
    title: getGameName(game, locale),
    description: getGameDescription(game, locale),
    path: `/games/${game.slug}`,
    image: game.banner_url ?? game.thumbnail_url ?? "/games/placeholder-banner.svg",
  });
}
