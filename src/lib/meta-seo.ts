import type { Metadata } from "next";
import { PLATFORM } from "@/lib/environments";
import { absoluteUrl, absoluteMediaUrl, META_CONFIG, getSiteUrl } from "@/lib/site-config";

const DEFAULT_OG = {
  width: 1200,
  height: 630,
  alt: PLATFORM.fullName,
};

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article";
  keywords?: string[];
  noIndex?: boolean;
}

export interface ProductMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt: string;
  price: number;
  currency: string;
  inStock: boolean;
  brand?: string | null;
  productId: string;
  sku: string;
}

function twitterImages(
  images: NonNullable<Metadata["openGraph"]>["images"]
): string[] {
  if (!images) return [META_CONFIG.defaultOgImage];
  const list = Array.isArray(images) ? images : [images];
  return list.map((i) => {
    if (typeof i === "string") return i;
    if (i instanceof URL) return i.toString();
    return typeof i.url === "string" ? i.url : i.url.toString();
  });
}

function buildOgImages(
  image?: string | null,
  alt?: string
): NonNullable<Metadata["openGraph"]>["images"] {
  const url = absoluteMediaUrl(image) ?? META_CONFIG.defaultOgImage;
  return [
    {
      url,
      width: DEFAULT_OG.width,
      height: DEFAULT_OG.height,
      alt: alt ?? DEFAULT_OG.alt,
      type: url.endsWith(".png") ? "image/png" : "image/jpeg",
    },
  ];
}

function baseVerification(): Metadata["verification"] {
  if (!META_CONFIG.domainVerification) return undefined;
  return {
    other: {
      "facebook-domain-verification": META_CONFIG.domainVerification,
    },
  };
}

function baseOther(): Record<string, string> {
  const other: Record<string, string> = {};
  if (META_CONFIG.domainVerification) {
    other["facebook-domain-verification"] = META_CONFIG.domainVerification;
  }
  if (META_CONFIG.appId) {
    other["fb:app_id"] = META_CONFIG.appId;
  }
  return other;
}

/** Standard page metadata — landing, environment home, catalogue */
export function buildPageMetadata(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  const images = buildOgImages(input.image, input.imageAlt ?? input.title);
  const other = baseOther();

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    metadataBase: new URL(getSiteUrl()),
    alternates: { canonical: input.path },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: PLATFORM.fullName,
      locale: "en_QA",
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: twitterImages(images),
    },
    verification: baseVerification(),
    other: Object.keys(other).length ? other : undefined,
  };
}

/** Product page metadata — Meta catalog ads + WhatsApp link previews */
export function buildProductMetadata(input: ProductMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  const images = buildOgImages(input.image, input.imageAlt);
  const other: Record<string, string> = {
    ...baseOther(),
    "product:price:amount": input.price.toFixed(2),
    "product:price:currency": input.currency,
    "product:availability": input.inStock ? "in stock" : "out of stock",
    "product:condition": "new",
    "product:retailer_item_id": input.productId,
    "product:item_group_id": input.sku,
  };
  if (input.brand) other["product:brand"] = input.brand;

  return {
    title: input.title,
    description: input.description,
    metadataBase: new URL(getSiteUrl()),
    alternates: { canonical: input.path },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: PLATFORM.fullName,
      locale: "en_QA",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: twitterImages(images),
    },
    verification: baseVerification(),
    other,
  };
}
