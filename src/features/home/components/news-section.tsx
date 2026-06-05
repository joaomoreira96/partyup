import { SectionHeading } from "@/components/design/section-heading";
import { getNewsContent, getNewsTitle } from "@/lib/news-localized";
import { newsExcerpt } from "@/lib/news-excerpt";
import type { Locale } from "@/i18n/config";
import type { NewsPost } from "@/types/platform";

function formatNewsDate(iso: string, locale: Locale) {
  return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NewsSection({
  news,
  title,
  locale,
}: {
  news: NewsPost[];
  title: string;
  locale: Locale;
}) {
  if (news.length === 0) return null;

  return (
    <section className="party-section" aria-labelledby="news-heading">
      <SectionHeading id="news-heading" title={title} />
      <ul className="grid gap-4 sm:grid-cols-3">
        {news.map((item) => (
          <li
            key={item.id}
            className="party-card-premium flex flex-col gap-2 p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {formatNewsDate(item.created_at, locale)}
            </p>
            <h3 className="font-semibold">{getNewsTitle(item, locale)}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {newsExcerpt(getNewsContent(item, locale))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
