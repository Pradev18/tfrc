/**
 * Report PDFs are a private owner record.
 * The destination is fixed. Callers must never pass a phone number.
 */
export const REPORT_OWNER_WHATSAPP = "97455049229";

export function ownerWhatsAppChatUrl(message: string): string {
  return `https://wa.me/${REPORT_OWNER_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function isOwnerWhatsAppHref(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.hostname !== "wa.me") return false;
    return url.pathname.replace(/\D/g, "") === REPORT_OWNER_WHATSAPP;
  } catch {
    return false;
  }
}

export function buildOwnerReportCaption(input: {
  title: string;
  customerName: string;
  reportDate: string;
  lineCount: number;
}): string {
  const lines = [
    "TFRC report copy for your records",
    input.title.trim() || "Report",
    input.customerName.trim() ? `Customer: ${input.customerName.trim()}` : "",
    input.reportDate.trim() ? `Date: ${input.reportDate.trim()}` : "",
    `Items: ${input.lineCount}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Sends the PDF document from the WhatsApp Cloud API, if configured.
 * Recipient is always REPORT_OWNER_WHATSAPP — not taken from the request.
 */
export async function sendPdfToOwnerWhatsApp(opts: {
  pdf: Buffer;
  filename: string;
  caption: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { sent: false, reason: "not_configured" };
  }

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "application/pdf");
  form.set(
    "file",
    new Blob([new Uint8Array(opts.pdf)], { type: "application/pdf" }),
    opts.filename
  );

  const upload = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  const uploaded = (await upload.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!upload.ok || !uploaded.id) {
    return { sent: false, reason: uploaded.error?.message || "Could not upload the PDF" };
  }

  const send = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: REPORT_OWNER_WHATSAPP,
        type: "document",
        document: {
          id: uploaded.id,
          filename: opts.filename,
          caption: opts.caption.slice(0, 1024),
        },
      }),
    }
  );
  const sentBody = (await send.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!send.ok) {
    return { sent: false, reason: sentBody.error?.message || "WhatsApp did not accept the PDF" };
  }
  return { sent: true };
}
