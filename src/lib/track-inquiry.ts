"use client";

import type { TrackInquiryPayload } from "@/lib/inquiry-types";
import { getOrCreateSessionId, getStoredContact } from "@/lib/customer-session";

export function trackCustomerInquiry(payload: TrackInquiryPayload): void {
  if (typeof window === "undefined") return;

  const contact = getStoredContact();
  const body = JSON.stringify({
    ...payload,
    sessionId: payload.sessionId ?? getOrCreateSessionId(),
    customerName: payload.customerName ?? (contact.name || undefined),
    customerPhone: payload.customerPhone ?? (contact.phone || undefined),
    pagePath: payload.pagePath ?? window.location.pathname + window.location.search,
    referrer: payload.referrer ?? (document.referrer || undefined),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/inquiries", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }

  fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Silent — never block checkout
  });
}
