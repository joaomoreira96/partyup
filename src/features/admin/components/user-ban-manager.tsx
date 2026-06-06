"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldBan, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatBanUntil, isBanActive } from "@/lib/auth/ban";
import { useI18n } from "@/features/i18n/locale-provider";
import type { AdminUserRow } from "@/types/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { ADMIN_PAGE_SIZE, paginateSlice, parsePageParam } from "@/lib/pagination";

type BanFormState = {
  permanent: boolean;
  bannedUntil: string;
  reason: string;
};

const emptyBanForm = (): BanFormState => ({
  permanent: true,
  bannedUntil: "",
  reason: "",
});

export function UserBanManager({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState(initialUsers);
  const usersPage = parsePageParam(searchParams.get("page"));
  const usersPagination = useMemo(
    () => paginateSlice(users, usersPage, ADMIN_PAGE_SIZE),
    [users, usersPage]
  );
  const pagedUsers = usersPagination.items;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [banForm, setBanForm] = useState<BanFormState>(emptyBanForm);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const params = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/admin/users${params}`);
      if (!res.ok) throw new Error("fetch_failed");
      const data = (await res.json()) as { users: AdminUserRow[] };
      setUsers(data.users);
    } catch {
      toast.error(t("admin.users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, fetchUsers]);

  function openBanDialog(user: AdminUserRow) {
    setSelected(user);
    setBanForm({
      permanent: !user.banned_until,
      bannedUntil: user.banned_until
        ? new Date(user.banned_until).toISOString().slice(0, 16)
        : "",
      reason: user.ban_reason ?? "",
    });
  }

  function closeDialog() {
    setSelected(null);
    setBanForm(emptyBanForm());
  }

  async function applyBan() {
    if (!selected) return;

    if (!banForm.reason.trim()) {
      toast.error(t("admin.users.reasonRequired"));
      return;
    }

    if (!banForm.permanent && !banForm.bannedUntil) {
      toast.error(t("admin.users.untilRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          is_banned: true,
          banned_until: banForm.permanent
            ? null
            : new Date(banForm.bannedUntil).toISOString(),
          ban_reason: banForm.reason.trim(),
        }),
      });

      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? t("admin.users.saveError"));
        return;
      }

      toast.success(t("admin.users.banApplied"));
      closeDialog();
      await fetchUsers(query);
    } catch {
      toast.error(t("admin.users.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function removeBan(user: AdminUserRow) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          is_banned: false,
          banned_until: null,
          ban_reason: null,
        }),
      });

      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? t("admin.users.saveError"));
        return;
      }

      toast.success(t("admin.users.unbanApplied"));
      await fetchUsers(query);
    } catch {
      toast.error(t("admin.users.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function banBadge(user: AdminUserRow) {
    if (!isBanActive(user)) {
      return <Badge variant="outline">{t("admin.users.statusActive")}</Badge>;
    }
    if (!user.banned_until) {
      return <Badge variant="destructive">{t("admin.users.statusBannedPermanent")}</Badge>;
    }
    const until = formatBanUntil(user.banned_until, locale);
    return (
      <Badge variant="destructive">
        {t("admin.users.statusBannedUntil", { until: until ?? "" })}
      </Badge>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.users.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.users.subtitle")}</p>
        </div>
        <div className="w-full max-w-xs">
          <Label htmlFor="user-search" className="sr-only">
            {t("admin.users.search")}
          </Label>
          <Input
            id="user-search"
            placeholder={t("admin.users.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {loading && users.length === 0 ? (
          <li className="flex items-center gap-2 rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </li>
        ) : users.length === 0 ? (
          <li className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("admin.users.empty")}
          </li>
        ) : (
          pagedUsers.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {user.display_name || t("common.player")}
                  {user.username ? (
                    <span className="ml-2 text-sm text-muted-foreground">@{user.username}</span>
                  ) : null}
                </p>
                {user.ban_reason && isBanActive(user) ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("admin.users.reasonLabel")}: {user.ban_reason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {user.role === "admin" ? (
                  <Badge>{t("admin.users.roleAdmin")}</Badge>
                ) : (
                  banBadge(user)
                )}
                {user.role !== "admin" && (
                  <>
                    {isBanActive(user) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void removeBan(user)}
                      >
                        <ShieldCheck className="size-4" aria-hidden />
                        {t("admin.users.unban")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={saving}
                        onClick={() => openBanDialog(user)}
                      >
                        <ShieldBan className="size-4" aria-hidden />
                        {t("admin.users.ban")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      <PaginationControls
        page={usersPagination.page}
        totalPages={usersPagination.totalPages}
        totalItems={usersPagination.totalItems}
        rangeStart={usersPagination.rangeStart}
        rangeEnd={usersPagination.rangeEnd}
        className="mt-4"
      />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.banTitle")}</DialogTitle>
            <DialogDescription>
              {selected
                ? t("admin.users.banDescription", {
                    name: selected.display_name || selected.username || t("common.player"),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ban-reason">{t("admin.users.reasonLabel")}</Label>
              <Input
                id="ban-reason"
                value={banForm.reason}
                onChange={(e) => setBanForm((f) => ({ ...f, reason: e.target.value }))}
                maxLength={500}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={banForm.permanent}
                onChange={(e) =>
                  setBanForm((f) => ({ ...f, permanent: e.target.checked }))
                }
                className="size-4 rounded border"
              />
              {t("admin.users.permanentBan")}
            </label>

            {!banForm.permanent && (
              <div className="space-y-2">
                <Label htmlFor="ban-until">{t("admin.users.untilLabel")}</Label>
                <Input
                  id="ban-until"
                  type="datetime-local"
                  value={banForm.bannedUntil}
                  onChange={(e) =>
                    setBanForm((f) => ({ ...f, bannedUntil: e.target.value }))
                  }
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void applyBan()} disabled={saving}>
              {saving ? t("common.loading") : t("admin.users.confirmBan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
