"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { refresh } = useUser();
  const { t } = useI18n();

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(t("auth.logoutError"));
      return;
    }
    await refresh();
    onDone?.();
    router.push("/");
    router.refresh();
    toast.success(t("auth.logoutSuccess"));
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={() => void handleLogout()}
    >
      <LogOut className="size-4" aria-hidden />
      <span>{t("nav.logout")}</span>
    </Button>
  );
}
