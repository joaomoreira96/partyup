"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
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
      toast.error("Indica um nome a mostrar.");
      return;
    }

    const needsTag = !profile.username;
    if (needsTag && !tag) {
      toast.error("Define a tua tag de jogador.");
      return;
    }

    if (tag && !tagCheck.ok) {
      toast.error(tagCheck.message);
      return;
    }

    setSavingProfile(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Entra novamente.");
        return;
      }

      if (tag && tag !== (profile.username ?? "")) {
        const available = await isUsernameAvailableClient(tag, user.id);
        if (!available) {
          toast.error("Esta tag já está a ser usada. Escolhe outra.");
          return;
        }
      }

      const result = await saveProfileClient({
        display_name: displayName.trim(),
        ...(tag && tag !== (profile.username ?? "") ? { username: tag } : {}),
        ...(avatarUrl && avatarUrl !== (profile.avatar_url ?? "")
          ? { avatar_url: avatarUrl }
          : {}),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Perfil atualizado.");
      await refresh();
    } catch {
      toast.error("Erro de ligação. Tenta novamente.");
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
      toast.success("Avatar atualizado.");
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
        toast.error("Sessão expirada. Entra novamente.");
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
      toast.success("Foto de perfil atualizada.");
      await refresh();
    } catch {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      toast.error("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(
          error.message.includes("same")
            ? "Escolhe uma palavra-passe diferente da atual."
            : "Não foi possível alterar a palavra-passe."
        );
        return;
      }
      toast.success("Palavra-passe alterada.");
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
        Definições da conta
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tag, avatar e segurança. A tag é única e aparece nos rankings e salas.
      </p>

      <Tabs defaultValue="perfil" className="mt-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
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
                Enviar foto
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF — máx. 2 MB</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Avatares rápidos</p>
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
            <Label htmlFor="profile-display-name">Nome a mostrar</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-username">Tag de jogador</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                placeholder="ex: party_hero"
                maxLength={20}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Pré-visualização:{" "}
              <span className="font-medium text-foreground">@{tagPreview}</span>
              {!profile.username && " — ainda não definida na conta"}
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
                A guardar...
              </>
            ) : (
              "Guardar perfil"
            )}
          </Button>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Altera a palavra-passe da tua conta PartyUp (Supabase Auth).
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova palavra-passe</Label>
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
            <Label htmlFor="confirm-password">Confirmar palavra-passe</Label>
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
            {savingPassword ? "A guardar..." : "Alterar palavra-passe"}
          </Button>
        </TabsContent>
      </Tabs>
    </section>
  );
}
