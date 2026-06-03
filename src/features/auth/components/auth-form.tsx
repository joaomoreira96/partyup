"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  normalizeUsername,
  suggestUsernameFromDisplayName,
  suggestUsernameFromEmail,
  validateUsername,
} from "@/lib/profile/username";
import { useUser } from "@/hooks/use-user";
import { useI18n } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { refresh } = useUser();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerTag, setPlayerTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function mapAuthError(message: string): string {
    if (message.includes("Invalid login")) return t("auth.errors.invalidLogin");
    if (message.includes("already registered")) return t("auth.errors.alreadyRegistered");
    if (message.includes("Password")) return t("auth.errors.passwordMin");
    return t("auth.errors.generic");
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p>{t("auth.unavailable")}</p>
        <Button variant="link" asChild className="mt-2">
          <Link href="/">{t("auth.backHome")}</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "register") {
      const name = displayName.trim() || email.split("@")[0];
      const tagRaw =
        playerTag.trim() ||
        suggestUsernameFromDisplayName(name) ||
        suggestUsernameFromEmail(email);
      const username = normalizeUsername(tagRaw);
      const tagCheck = validateUsername(username);
      if (!tagCheck.ok) {
        setError(t(`auth.usernameErrors.${tagCheck.code}`));
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            username,
          },
        },
      });
      if (signUpError) {
        setError(mapAuthError(signUpError.message));
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(mapAuthError(signInError.message));
        setLoading(false);
        return;
      }
    }

    await refresh();
    router.push("/profile");
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {mode === "register" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="display-name">{t("auth.displayName")}</Label>
            <Input
              id="display-name"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-tag">{t("auth.playerTag")}</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="player-tag"
                autoComplete="username"
                placeholder={t("profile.settings.tagPlaceholder")}
                value={playerTag}
                onChange={(e) => setPlayerTag(normalizeUsername(e.target.value))}
                maxLength={20}
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("auth.tagAutoHint")}</p>
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? t("auth.processing")
          : mode === "register"
            ? t("auth.registerCta")
            : t("auth.loginCta")}
      </Button>
    </form>
  );
}
