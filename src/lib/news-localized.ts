import type { Locale } from "@/i18n/config";
import type { NewsPost } from "@/types/platform";

export function getNewsTitle(post: NewsPost, locale: Locale): string {
  if (locale === "en") {
    return post.title_en.trim() || post.title;
  }
  return post.title;
}

export function getNewsContent(post: NewsPost, locale: Locale): string {
  if (locale === "en") {
    return post.content_en.trim() || post.content;
  }
  return post.content;
}
