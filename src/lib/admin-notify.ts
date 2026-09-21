/** Clear popup for admin users on any device (no silent failures). */
export function adminNotify(message: string) {
  const text = String(message || "").trim();
  if (!text || typeof window === "undefined") return;
  window.alert(text);
}
