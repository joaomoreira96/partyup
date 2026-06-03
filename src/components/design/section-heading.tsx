import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SectionHeading({
  title,
  id,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  id?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <h2 id={id} className="text-2xl font-bold tracking-tight">
        {title}
      </h2>
      {actionLabel && actionHref && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
