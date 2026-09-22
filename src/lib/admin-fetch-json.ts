/**
 * Safe JSON reader for admin fetch calls.
 * Proxies/gateways often return HTML error pages; never let that become a cryptic JSON parse crash.
 */

export type AdminJson = Record<string, unknown>;

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 200).trim().toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body") ||
    head.includes("<title>")
  );
}

export function errorFromHttpStatus(status: number, fallback = "Request failed"): string {
  if (status === 413) {
    return "File is too large for the server. Use an .xlsx under 30 MB, or split the workbook.";
  }
  if (status === 401 || status === 403) {
    return "Upload was blocked (403/401). Sign in again on https://tfrcwholesale.com/admin. Special characters in the Excel file name are stripped automatically; retry the upload.";
  }
  if (status === 404) {
    return "That report endpoint was not found. Redeploy, then retry.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return `Server timed out or restarted (${status}). Large Excel files are saved in batches — retry Upload or press Resume import. This is not an Excel format problem.`;
  }
  if (status >= 500) {
    return `Server error (${status}). Retry once. If it keeps failing, check the workbook sheets or redeploy.`;
  }
  return `${fallback} (${status}).`;
}

export async function readAdminJson(res: Response, fallback = "Request failed"): Promise<AdminJson> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(errorFromHttpStatus(res.status, fallback));
    return {};
  }
  try {
    return JSON.parse(text) as AdminJson;
  } catch {
    if (looksLikeHtml(text)) {
      throw new Error(errorFromHttpStatus(res.status, fallback));
    }
    throw new Error(
      res.ok
        ? "Server returned an unexpected response. Retry the action."
        : errorFromHttpStatus(res.status, fallback)
    );
  }
}

export function adminErrorMessage(data: AdminJson, fallback: string): string {
  const err = data.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return fallback;
}
