import { cn } from "@/lib/utils";

/** Offset for fixed navbar */
export function MainShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      id="main-content"
      className={cn(
        "mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:max-w-7xl",
        className
      )}
    >
      {children}
    </main>
  );
}
