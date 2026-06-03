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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function mapAuthError(message: string): string {
  if (message.includes("Invalid login")) return "Email ou palavra-passe incorretos.";
  if (message.includes("already registered")) return "Este email já está registado.";
  if (message.includes("Password")) return "A palavra-passe deve ter pelo menos 6 caracteres.";
  return "Não foi possível concluir o pedido. Verifica os dados e tenta novamente.";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerTag, setPlayerTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p>Autenticação indisponível. Configura o Supabase em .env.local.</p>
        <Button variant="link" asChild className="mt-2">
          <Link href="/">Voltar ao início</Link>
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
        setError(tagCheck.message);
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
            <Label htmlFor="display-name">Nome a mostrar</Label>
            <Input
              id="display-name"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-tag">Tag de jogador</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="player-tag"
                autoComplete="username"
                placeholder="ex: party_hero"
                value={playerTag}
                onChange={(e) => setPlayerTag(normalizeUsername(e.target.value))}
                maxLength={20}
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Letras minúsculas, números e _. Se deixares vazio, geramos uma tag
              a partir do teu nome.
            </p>
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
        <Label htmlFor="password">Palavra-passe</Label>
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
        {loading ? "A processar..." : mode === "register" ? "Criar conta" : "Entrar"}
      </Button>
    </form>
  );
}
