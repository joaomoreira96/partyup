"use client";

import { SectionHeading } from "@/components/design/section-heading";
import { useI18n } from "@/features/i18n/locale-provider";

const NEWS_KEYS = [
  { title: "home.news.item1Title", date: "home.news.item1Date", excerpt: "home.news.item1Excerpt" },
  { title: "home.news.item2Title", date: "home.news.item2Date", excerpt: "home.news.item2Excerpt" },
  { title: "home.news.item3Title", date: "home.news.item3Date", excerpt: "home.news.item3Excerpt" },
] as const;

export function NewsSection() {
  const { t } = useI18n();

  return (
    <section className="party-section" aria-labelledby="news-heading">
      <SectionHeading id="news-heading" title={t("home.newsTitle")} />
      <ul className="grid gap-4 sm:grid-cols-3">
        {NEWS_KEYS.map((item) => (
          <li
            key={item.title}
            className="party-card-premium flex flex-col gap-2 p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {t(item.date)}
            </p>
            <h3 className="font-semibold">{t(item.title)}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(item.excerpt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
