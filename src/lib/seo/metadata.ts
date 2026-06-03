import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";

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

export function buildGameMetadata(game: {
  name: string;
  description: string;
  slug: string;
  banner_url?: string | null;
  thumbnail_url?: string | null;
}): Metadata {
  return buildPageMetadata({
    title: game.name,
    description: game.description,
    path: `/games/${game.slug}`,
    image: game.banner_url ?? game.thumbnail_url ?? "/games/placeholder-banner.svg",
  });
}
