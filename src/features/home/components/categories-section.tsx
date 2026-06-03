import Link from "next/link";
import { SectionHeading } from "@/components/design/section-heading";
import type { Category } from "@/types/platform";

export function CategoriesSection({ categories }: { categories: Category[] }) {
  return (
    <section className="party-section" aria-labelledby="categories-heading">
      <SectionHeading id="categories-heading" title="Categorias" />
      <ul className="flex flex-wrap gap-3">
        {categories.map((cat) => (
          <li key={cat.slug}>
            <Link
              href={`/games?category=${cat.slug}`}
              className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-primary/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              {cat.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
