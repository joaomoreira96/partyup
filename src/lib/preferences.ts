/** Persiste preferências (tema/idioma) do utilizador autenticado (best-effort). */
export async function savePreferences(prefs: {
  theme?: string;
  locale?: string;
}): Promise<void> {
  try {
    await fetch("/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  } catch {
    // best-effort: a preferência local continua aplicada mesmo se a gravação falhar
  }
}
