/** Central site + Meta/Facebook ad configuration */

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
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
  return `Hello, I saw your ${source} and would like to order from TFRC Vita Nova. Please help me.`;
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
