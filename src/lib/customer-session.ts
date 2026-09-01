const SESSION_KEY = "tfrc-vita-nova-session";
const CONTACT_KEY = "tfrc-vita-nova-contact";

export interface StoredContact {
  name: string;
  phone: string;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function getStoredContact(): StoredContact {
  if (typeof window === "undefined") return { name: "", phone: "" };
  try {
    const raw = localStorage.getItem(CONTACT_KEY);
    if (!raw) return { name: "", phone: "" };
    const parsed = JSON.parse(raw) as StoredContact;
    return {
      name: parsed.name?.trim() ?? "",
      phone: parsed.phone?.replace(/\D/g, "") ?? "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

export function saveStoredContact(contact: StoredContact): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({
        name: contact.name.trim(),
        phone: contact.phone.replace(/\D/g, ""),
      })
    );
  } catch {
    // ignore quota errors
  }
}
