"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FavoriteGameToggleProps = {
  gameId: string;
  initialIsFavorite: boolean;
  variant?: "button" | "overlay" | "icon";
  className?: string;
  onChange?: (isFavorite: boolean) => void;
};

export function FavoriteGameToggle({
  gameId,
  initialIsFavorite,
  variant = "button",
  className,
  onChange,
}: FavoriteGameToggleProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);

  async function toggleFavorite(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();

    setLoading(true);
    try {
      const res = await fetch(`/api/games/${gameId}/favorite`, { method: "POST" });
      const data = (await res.json()) as {
        isFavorite?: boolean;
        message?: string;
      };

      if (!res.ok) {
        toast.error(data.message ?? t("games.favorite.error"));
        return;
      }

      const next = Boolean(data.isFavorite);
      setIsFavorite(next);
      onChange?.(next);
      toast.success(next ? t("games.favorite.added") : t("games.favorite.removed"));
      router.refresh();
    } catch {
      toast.error(t("games.favorite.error"));
    } finally {
      setLoading(false);
    }
  }

  const label = isFavorite ? t("games.favorite.remove") : t("games.favorite.add");

  if (variant === "overlay" || variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          "rounded-full shadow-sm backdrop-blur-sm transition-colors",
          isFavorite
            ? "bg-rose-500 text-white shadow-md ring-2 ring-white/70 hover:bg-rose-600 hover:text-white dark:ring-white/40"
            : "bg-background/95 text-foreground/75 ring-1 ring-border/80 hover:bg-background hover:text-rose-500 dark:bg-card/90",
          className
        )}
        onClick={(event) => void toggleFavorite(event)}
        disabled={loading}
        aria-pressed={isFavorite}
        aria-label={label}
        title={label}
      >
        <Heart
          className={cn("size-4", isFavorite && "fill-current")}
          aria-hidden
        />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "w-full",
        isFavorite &&
          "border-rose-500/50 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300",
        className
      )}
      onClick={() => void toggleFavorite()}
      disabled={loading}
      aria-pressed={isFavorite}
    >
      <Heart
        className={cn(
          "size-4",
          isFavorite ? "fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400" : ""
        )}
        aria-hidden
      />
      {isFavorite ? t("games.favorite.favorited") : t("games.favorite.add")}
    </Button>
  );
}
