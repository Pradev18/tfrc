import type { CataloguePdfPayload } from "@/services/catalogue-pdf.service";
import { buildCataloguePdfDocument } from "@/lib/catalogue-pdf-document";
import { embedCatalogueImages, pdfImageOrPlaceholder } from "@/lib/catalogue-pdf-images";
import { getSiteUrl } from "@/lib/site-config";

/**
 * Shared production PDF assembly for ANY catalogue selected by id.
 * Do not special-case catalogue names/slugs — branding and content come
 * exclusively from the payload built for that catalogueId.
 */

export function absolutizeMediaUrl(url: string | null, origin: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}

/**
 * Shared production PDF assembly for any catalogueId:
 * payload (DB) → absolute media URLs → embed images → deterministic A4 PDF.
 * Used by the admin API route and the local preview script.
 * No catalogue-specific branches — only the payload differs.
 */
export async function assembleCataloguePdfDocument(
  payload: CataloguePdfPayload,
  options?: { origin?: string }
): Promise<{ pdf: Uint8Array; stats: CataloguePdfBuildStats }> {
  const origin = (options?.origin || getSiteUrl()).replace(/\/$/, "");
  const logoAbsolute = absolutizeMediaUrl(payload.catalogue.logoUrl, origin);
  const productUrls = payload.categories.flatMap((category) =>
    category.products.map((product) => absolutizeMediaUrl(product.imageUrl, origin))
  );

  const embedded = await embedCatalogueImages([logoAbsolute, ...productUrls]);

  let embeddedProductImages = 0;
  let fallbackProductImages = 0;

  const withAbsoluteMedia: CataloguePdfPayload = {
    ...payload,
    catalogue: {
      ...payload.catalogue,
      logoUrl: logoAbsolute ? embedded.get(logoAbsolute) ?? logoAbsolute : null,
    },
    categories: payload.categories.map((category) => ({
      ...category,
      products: category.products.map((product) => {
        const absolute = absolutizeMediaUrl(product.imageUrl, origin);
        const embeddedUri = absolute ? embedded.get(absolute) : undefined;
        if (embeddedUri?.startsWith("data:image/") && !embeddedUri.includes("svg+xml")) {
          embeddedProductImages += 1;
        } else if (!absolute || !embeddedUri) {
          fallbackProductImages += 1;
        } else if (embeddedUri.startsWith("data:")) {
          embeddedProductImages += 1;
        } else {
          fallbackProductImages += 1;
        }
        return {
          ...product,
          imageUrl: pdfImageOrPlaceholder(absolute, embedded, product.displayName),
        };
      }),
    })),
  };

  const document = buildCataloguePdfDocument(withAbsoluteMedia);

  return {
    pdf: document.bytes,
    stats: {
      origin,
      catalogueId: payload.catalogue.id,
      catalogueName: payload.catalogue.name,
      catalogueSlug: payload.catalogue.slug,
      websiteUrl: payload.websiteUrl,
      whatsappPhone: payload.whatsappPhone,
      totalProducts: payload.totalProducts,
      listedCards: payload.listedCards,
      categories: payload.categories.length,
      embeddedProductImages,
      fallbackProductImages,
      pageCount: document.stats.pageCount,
      productPages: document.stats.productPages,
      linkAnnotations: document.stats.linkAnnotations,
      renderedImages: document.stats.renderedImages,
      renderedFallbacks: document.stats.fallbackImages,
      pageCardCounts: document.stats.pageCardCounts,
      sampleNames: payload.categories
        .flatMap((c) => c.products)
        .slice(0, 5)
        .map((p) => p.displayName),
    },
  };
}

export interface CataloguePdfBuildStats {
  origin: string;
  catalogueId: string;
  catalogueName: string;
  catalogueSlug: string;
  websiteUrl: string;
  whatsappPhone: string;
  totalProducts: number;
  listedCards: number;
  categories: number;
  embeddedProductImages: number;
  fallbackProductImages: number;
  pageCount: number;
  productPages: number;
  linkAnnotations: number;
  renderedImages: number;
  renderedFallbacks: number;
  pageCardCounts: number[];
  sampleNames: string[];
}
