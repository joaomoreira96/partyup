import Link from "next/link";
import { AlertCircle, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "A carregar...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-border bg-card p-8 shadow-[var(--shadow-card)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="size-8 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-border bg-card/50 p-8 text-center">
      <Inbox className="size-10 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Button asChild className="mt-2">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Algo correu mal",
  description = "Não foi possível carregar esta página. Tenta novamente dentro de momentos.",
  retryHref,
}: {
  title?: string;
  description?: string;
  retryHref?: string;
}) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 p-8 text-center"
      role="alert"
    >
      <AlertCircle className="size-10 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold text-destructive">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {retryHref && (
        <Button variant="outline" asChild>
          <Link href={retryHref}>Tentar novamente</Link>
        </Button>
      )}
    </div>
  );
}

export function SuccessState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success/10 p-6 text-center"
      role="status"
    >
      <CheckCircle2 className="size-8 text-success" aria-hidden />
      <h2 className="font-semibold text-success">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
