"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_PRESETS } from "@/lib/profile/avatar-presets";
import {
  mapStorageUploadError,
  resolveAvatarFile,
} from "@/lib/profile/avatar-file";
import {
  isUsernameAvailableClient,
  saveProfileClient,
} from "@/lib/profile/save-profile-client";
import {
  normalizeUsername,
  validateUsername,
} from "@/lib/profile/username";
import { useUser } from "@/hooks/use-user";
import { useI18n } from "@/features/i18n/locale-provider";
import type { Profile } from "@/types/platform";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileSettings({ profile }: { profile: Profile }) {
  const { refresh } = useUser();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [publicProfile, setPublicProfile] = useState(profile.public_profile !== false);
  const [showActivity, setShowActivity] = useState(profile.show_activity !== false);
  const [showCountry, setShowCountry] = useState(profile.show_country !== false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile() {
    const tag = normalizeUsername(username);
    const tagCheck = validateUsername(tag);

    if (!displayName.trim()) {
      toast.error(t("profile.settings.toasts.displayNameRequired"));
      return;
    }

    const needsTag = !profile.username;
    if (needsTag && !tag) {
      toast.error(t("profile.settings.toasts.tagRequired"));
      return;
    }

    if (tag && !tagCheck.ok) {
      toast.error(t(`profile.usernameErrors.${tagCheck.code}`));
      return;
    }

    setSavingProfile(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("profile.settings.toasts.sessionExpired"));
        return;
      }

      if (tag && tag !== (profile.username ?? "")) {
        const available = await isUsernameAvailableClient(tag, user.id);
        if (!available) {
          toast.error(t("profile.settings.toasts.tagTaken"));
          return;
        }
      }

      const result = await saveProfileClient({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        country: country.trim() || null,
        public_profile: publicProfile,
        show_activity: showActivity,
        show_country: showCountry,
        ...(tag && tag !== (profile.username ?? "") ? { username: tag } : {}),
        ...(avatarUrl && avatarUrl !== (profile.avatar_url ?? "")
          ? { avatar_url: avatarUrl }
          : {}),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(t("profile.settings.toasts.profileUpdated"));
      await refresh();
    } catch {
      toast.error(t("profile.settings.toasts.connectionError"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function selectPreset(url: string) {
    setAvatarUrl(url);
    setSavingProfile(true);
    try {
      const result = await saveProfileClient({ avatar_url: url });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(t("profile.settings.toasts.avatarUpdated"));
      await refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    const resolved = resolveAvatarFile(file);
    if (!resolved.ok) {
      toast.error(resolved.message);
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t("profile.settings.toasts.sessionExpired"));
        return;
      }

      const path = `${user.id}/avatar.${resolved.ext}`;

      await supabase.storage.from("avatars").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          contentType: resolved.mime,
          upsert: true,
        });

      if (uploadError) {
        toast.error(mapStorageUploadError(uploadError.message));
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const cacheBusted = `${publicUrl}?v=${Date.now()}`;

      const result = await saveProfileClient({ avatar_url: cacheBusted });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setAvatarUrl(cacheBusted);
      toast.success(t("profile.settings.toasts.photoUpdated"));
      await refresh();
    } catch {
      toast.error(t("profile.settings.toasts.uploadError"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      toast.error(t("profile.settings.toasts.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("profile.settings.toasts.passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(
          error.message.includes("same")
            ? t("profile.settings.toasts.passwordSame")
            : t("profile.settings.toasts.passwordChangeFailed")
        );
        return;
      }
      toast.success(t("profile.settings.toasts.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPassword(false);
    }
  }

  const tagPreview = normalizeUsername(username) || "—";

  return (
    <section className="party-card mt-8 p-6" aria-labelledby="profile-settings-title">
      <h2 id="profile-settings-title" className="text-lg font-semibold">
        {t("profile.settings.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("profile.settings.subtitle")}
      </p>

      {profile.username ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/players/${profile.username}`}
            className="font-medium text-primary hover:underline"
          >
            {t("profile.settings.viewPublic")}
          </Link>
        </p>
      ) : null}

      <Tabs defaultValue="perfil" className="mt-6">
        <TabsList className="w-full flex-wrap sm:w-auto">
          <TabsTrigger value="perfil">{t("profile.settings.tabProfile")}</TabsTrigger>
          <TabsTrigger value="privacidade">{t("profile.settings.tabPrivacy")}</TabsTrigger>
          <TabsTrigger value="seguranca">{t("profile.settings.tabSecurity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6 space-y-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="size-20 ring-2 ring-primary/30">
              <AvatarImage src={avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-secondary text-lg">
                {initials(displayName || "PU")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Camera className="size-4" aria-hidden />
                )}
                {t("profile.settings.uploadPhoto")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("profile.settings.uploadHint")}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t("profile.settings.quickAvatars")}</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  disabled={savingProfile || uploadingAvatar}
                  onClick={() => void selectPreset(preset.url)}
                  className={`rounded-full ring-2 ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-ring ${
                    avatarUrl === preset.url ? "ring-primary" : "ring-transparent hover:ring-border"
                  }`}
                >
                  <Image
                    src={preset.url}
                    alt={preset.label}
                    width={48}
                    height={48}
                    unoptimized
                    className="size-12 rounded-full bg-muted"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-display-name">{t("profile.settings.displayName")}</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-bio">{t("profile.settings.bio")}</Label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder={t("profile.settings.bioPlaceholder")}
              className="flex w-full rounded-[var(--radius-md)] border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-country">{t("profile.settings.country")}</Label>
            <Input
              id="profile-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={60}
              placeholder={t("profile.settings.countryPlaceholder")}
              autoComplete="country-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-username">{t("profile.settings.playerTag")}</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                placeholder={t("profile.settings.tagPlaceholder")}
                maxLength={20}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("profile.settings.tagPreview")}{" "}
              <span className="font-medium text-foreground">@{tagPreview}</span>
              {!profile.username && t("profile.settings.tagNotSet")}
            </p>
          </div>

          <Button
            type="button"
            disabled={savingProfile || uploadingAvatar}
            onClick={() => void saveProfile()}
          >
            {savingProfile ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("profile.settings.saving")}
              </>
            ) : (
              t("profile.settings.saveProfile")
            )}
          </Button>
        </TabsContent>

        <TabsContent value="privacidade" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            {t("profile.settings.privacyIntro")}{" "}
            {profile.username ? (
              <Link href={`/players/${profile.username}`} className="text-primary hover:underline">
                /players/{profile.username}
              </Link>
            ) : (
              t("profile.settings.privacyPublicPath")
            )}
            .
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <input
                id="public-profile"
                type="checkbox"
                checked={publicProfile}
                onChange={(e) => setPublicProfile(e.target.checked)}
                className="mt-1 size-4 rounded border-input"
              />
              <label htmlFor="public-profile" className="text-sm leading-snug">
                <span className="font-medium">{t("profile.settings.publicProfile")}</span>
                <span className="block text-muted-foreground">
                  {t("profile.settings.publicProfileHint")}
                </span>
              </label>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="show-activity"
                type="checkbox"
                checked={showActivity}
                onChange={(e) => setShowActivity(e.target.checked)}
                className="mt-1 size-4 rounded border-input"
              />
              <label htmlFor="show-activity" className="text-sm leading-snug">
                <span className="font-medium">{t("profile.settings.showActivity")}</span>
                <span className="block text-muted-foreground">
                  {t("profile.settings.showActivityHint")}
                </span>
              </label>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="show-country"
                type="checkbox"
                checked={showCountry}
                onChange={(e) => setShowCountry(e.target.checked)}
                className="mt-1 size-4 rounded border-input"
              />
              <label htmlFor="show-country" className="text-sm leading-snug">
                <span className="font-medium">{t("profile.settings.showCountry")}</span>
                <span className="block text-muted-foreground">
                  {t("profile.settings.showCountryHint")}
                </span>
              </label>
            </li>
          </ul>
          <Button
            type="button"
            disabled={savingProfile}
            onClick={() => void saveProfile()}
          >
            {t("profile.settings.savePrivacy")}
          </Button>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("profile.settings.securityHintSupabase")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("profile.settings.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("profile.settings.confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={savingPassword}
            onClick={() => void changePassword()}
          >
            {savingPassword
              ? t("profile.settings.saving")
              : t("profile.settings.changePassword")}
          </Button>
        </TabsContent>
      </Tabs>
    </section>
  );
}
