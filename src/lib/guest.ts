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

export function getGuestName(): string {
  if (typeof window === "undefined") return "Convidado";
  return localStorage.getItem(GUEST_NAME_KEY) ?? "Convidado";
}

export function setGuestName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_NAME_KEY, name.trim() || "Convidado");
}
