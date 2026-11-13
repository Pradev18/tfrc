/**
 * Brand logos live in Cloudflare R2 under the BRAND_LOGO/ prefix.
 * Accepts a full https URL or a key/filename and returns a public URL.
 * Isolated from product image_link handling.
 */

export const BRAND_LOGO_R2_PREFIX = "BRAND_LOGO";

function r2PublicBase(): string | null {
  const base = process.env.R2_PUBLIC_URL?.trim();
  return base ? base.replace(/\/+$/, "") : null;
}

function looksLikeImageFile(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
}

/**
 * Normalize Excel/admin brand logo input to a public https URL, or null if empty/invalid.
 *
 * Accepted forms:
 * - https://…/BRAND_LOGO/levi.png
 * - BRAND_LOGO/levi.png
 * - levi.png  → BRAND_LOGO/levi.png on R2
 */
export function normalizeBrandLogoInput(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  const base = r2PublicBase();
  if (!base) return null;

  let key = value.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key.toUpperCase().startsWith(`${BRAND_LOGO_R2_PREFIX}/`)) {
    if (!looksLikeImageFile(key) || key.includes("/")) return null;
    key = `${BRAND_LOGO_R2_PREFIX}/${key}`;
  } else {
    // Preserve folder casing as BRAND_LOGO/
    key = `${BRAND_LOGO_R2_PREFIX}/${key.slice(BRAND_LOGO_R2_PREFIX.length + 1)}`;
  }

  if (!looksLikeImageFile(key)) return null;
  return `${base}/${key}`;
}

export function brandLogoPublicExample(filename = "brand-name.png"): string {
  const base = r2PublicBase() || "https://YOUR_R2_PUBLIC_URL";
  return `${base}/${BRAND_LOGO_R2_PREFIX}/${filename}`;
}
