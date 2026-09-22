/** Central site + Meta/Facebook ad configuration */

/** Apex domain serves Hostinger parking; app lives on www. */
export function normalizePublicSiteUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "vitanovaservices.com") {
      parsed.hostname = "www.vitanovaservices.com";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return normalizePublicSiteUrl(url);
}

/**
 * Prefer the host the browser actually used (www), then env.
 * Prevents approval emails linking to the Hostinger parked apex domain.
 */
export function getRequestSiteUrl(headers: Headers, fallbackOrigin?: string): string {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.trim() || "";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (fallbackOrigin?.startsWith("http://") ? "http" : "https");

  if (host && !/^localhost(:\d+)?$/i.test(host) && host !== "127.0.0.1") {
    return normalizePublicSiteUrl(`${proto}://${host}`);
  }

  if (fallbackOrigin) return normalizePublicSiteUrl(fallbackOrigin);
  return getSiteUrl();
}

/**
 * Customer-facing HTTPS origin for printable assets (PDF website QR / cover link).
 * Never emit localhost in a brochure — phones cannot open that URL.
 * Prefer PDF_SITE_URL, then NEXT_PUBLIC_SITE_URL when it is a public host,
 * then the known production catalogue domain.
 */
export function getPublicCatalogueSiteUrl(): string {
  const candidates = [
    process.env.PDF_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const candidate of candidates) {
    const url = candidate?.trim().replace(/\/$/, "");
    if (url && !isLocalSiteUrl(url)) return normalizePublicSiteUrl(url);
  }

  return "https://www.vitanovaservices.com";
}

function isLocalSiteUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

/**
 * Resolve site URL for WhatsApp product links.
 * Server: env → localhost default.
 * Client: explicit prop → env → window.origin (works on any catalogue domain/path).
 */
export function resolveSiteUrl(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (envUrl) return envUrl.replace(/\/$/, "");
    return window.location.origin;
  }

  return getSiteUrl();
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

export function absoluteMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return absoluteUrl(url);
}

export const META_CONFIG = {
  pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  appId: process.env.NEXT_PUBLIC_META_APP_ID ?? "",
  domainVerification: process.env.META_DOMAIN_VERIFICATION ?? "",
  defaultOgImage: absoluteUrl("/opengraph-image"),
  whatsappPhone: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "97455049229",
} as const;

/** Short pre-filled message for Meta Click-to-WhatsApp ads */
export function getWhatsAppAdMessage(source = "Meta ad"): string {
  return `Hello, I saw your ${source} and would like to order from TFRC Wholesale Services. Please help me.`;
}

export function getWhatsAppAdUrl(source = "Meta ad"): string {
  const phone = META_CONFIG.whatsappPhone.replace(/\D/g, "");
  const text = encodeURIComponent(getWhatsAppAdMessage(source));
  return `https://wa.me/${phone}?text=${text}`;
}

/** UTM params for catalogue links in Meta ads */
export function withUtmParams(
  path: string,
  params: { source?: string; medium?: string; campaign?: string; content?: string } = {}
): string {
  const url = new URL(absoluteUrl(path));
  url.searchParams.set("utm_source", params.source ?? "facebook");
  url.searchParams.set("utm_medium", params.medium ?? "paid");
  if (params.campaign) url.searchParams.set("utm_campaign", params.campaign);
  if (params.content) url.searchParams.set("utm_content", params.content);
  return url.pathname + url.search;
}
