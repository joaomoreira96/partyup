export function mapProfileSaveError(
  error?: string,
  code?: string
): string {
  const msg = (error ?? "").toLowerCase();
  if (code === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
    return "Esta tag já está a ser usada. Escolhe outra.";
  }
  if (msg.includes("row-level security") || code === "42501") {
    return "Sessão inválida. Sai da conta e volta a entrar.";
  }
  if (msg.includes("profile_not_found")) {
    return "Perfil em falta. Tenta sair e voltar a entrar.";
  }
  if (msg.includes("deleted_at") && msg.includes("does not exist")) {
    return "Base de dados desatualizada — aplica as migrações Supabase.";
  }
  return "Não foi possível guardar o perfil.";
}
