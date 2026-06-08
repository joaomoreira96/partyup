const GUEST_NAME_KEY = "partyup_guest_name";
const GUEST_ID_KEY = "partyup_guest_id";

export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/** Nome guardado pelo próprio utilizador, ou "" se ainda não definiu nenhum. */
export function getStoredGuestName(): string {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(GUEST_NAME_KEY) ?? "").trim();
}

/** Nome para apresentação, com fallback "Convidado" quando não há nada definido. */
export function getGuestName(): string {
  const stored = getStoredGuestName();
  return stored || "Convidado";
}

export function setGuestName(name: string) {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(GUEST_NAME_KEY, trimmed);
  } else {
    localStorage.removeItem(GUEST_NAME_KEY);
  }
}
