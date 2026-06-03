const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

export function validateUsername(username: string): { ok: true } | { ok: false; message: string } {
  if (!username) {
    return { ok: false, message: "Indica uma tag de jogador." };
  }
  if (username.length < 3) {
    return { ok: false, message: "A tag deve ter pelo menos 3 caracteres." };
  }
  if (username.length > 20) {
    return { ok: false, message: "A tag pode ter no máximo 20 caracteres." };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      message: "Usa apenas letras minúsculas, números e underscore (_).",
    };
  }
  return { ok: true };
}

export function suggestUsernameFromDisplayName(displayName: string): string {
  const base = normalizeUsername(displayName.replace(/\s+/g, "_"));
  if (base.length >= 3) return base.slice(0, 16);
  return "jogador";
}

export function suggestUsernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "player";
  const base = normalizeUsername(local);
  if (base.length >= 3) return base;
  return "jogador";
}
