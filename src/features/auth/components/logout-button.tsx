"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
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

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível terminar sessão.");
      return;
    }
    await refresh();
    onDone?.();
    router.push("/");
    router.refresh();
    toast.success("Sessão terminada.");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={() => void handleLogout()}
    >
      <LogOut className="size-4" aria-hidden />
      <span>Sair</span>
    </Button>
  );
}
