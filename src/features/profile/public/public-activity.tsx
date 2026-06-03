import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import type { ProfileActivityItem } from "@/types/platform";

export function PublicActivity({ items }: { items: ProfileActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-xl font-bold">
        Atividade recente
      </h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-card/50 px-4 py-3 text-sm"
          >
            <span>{item.message}</span>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={item.createdAt}
            >
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: pt,
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
