import type { CataloguePdfPayload } from "@/services/catalogue-pdf.service";
import { buildCataloguePdfDocument } from "@/lib/catalogue-pdf-document";
import { embedCatalogueImages } from "@/lib/catalogue-pdf-images";
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
  const products = payload.categories.flatMap((category) => category.products);
  const candidateUrls = new Map(
    products.map((product) => {
      const sourceUrls =
        product.imageUrls && product.imageUrls.length > 0
          ? product.imageUrls
          : product.imageUrl
            ? [product.imageUrl]
            : [];
      return [
        product.id,
        [...new Set(sourceUrls.map((url) => absolutizeMediaUrl(url, origin)).filter(Boolean))] as string[],
      ] as const;
    })
  );

  const firstPass = await embedCatalogueImages([
    logoAbsolute,
    ...products.map((product) => candidateUrls.get(product.id)?.[0] ?? null),
  ]);
  const embedded = firstPass.embedded;
  const failures = firstPass.failures;

  // If a primary image is permanently unavailable, try the product's remaining
  // images in order. Only unresolved products trigger extra network work.
  const maxCandidates = Math.max(0, ...[...candidateUrls.values()].map((urls) => urls.length));
  for (let candidateIndex = 1; candidateIndex < maxCandidates; candidateIndex += 1) {
    const alternates = products.flatMap((product) => {
      const candidates = candidateUrls.get(product.id) ?? [];
      if (candidates.some((url) => embedded.has(url))) return [];
      return candidates[candidateIndex] ? [candidates[candidateIndex]!] : [];
    });
    if (alternates.length === 0) continue;
    const alternatePass = await embedCatalogueImages(alternates);
    for (const [url, dataUri] of alternatePass.embedded) embedded.set(url, dataUri);
    for (const [url, reason] of alternatePass.failures) failures.set(url, reason);
  }

  const productImageFailures = payload.categories.flatMap((category) =>
    category.products.flatMap((product) => {
      const candidates = candidateUrls.get(product.id) ?? [];
      if (candidates.length === 0) {
        return [{
          productId: product.productId,
          name: product.displayName,
          reason: "no image is assigned",
        }];
      }
      if (!candidates.some((url) => embedded.has(url))) {
        return [{
          productId: product.productId,
          name: product.displayName,
          reason:
            candidates.map((url) => failures.get(url)).find(Boolean) ||
            "all assigned images could not be embedded",
        }];
      }
      return [];
    })
  );

  if (productImageFailures.length > 0) {
    throw new CataloguePdfImageError(productImageFailures);
  }

  let embeddedProductImages = 0;

  const withAbsoluteMedia: CataloguePdfPayload = {
    ...payload,
    catalogue: {
      ...payload.catalogue,
      logoUrl: logoAbsolute ? embedded.get(logoAbsolute) ?? logoAbsolute : null,
    },
    categories: payload.categories.map((category) => ({
      ...category,
      products: category.products.map((product) => {
        const selectedUrl = (candidateUrls.get(product.id) ?? []).find((url) =>
          embedded.has(url)
        );
        const embeddedUri = selectedUrl ? embedded.get(selectedUrl) : undefined;
        // Missing/invalid product assets were rejected above, before rendering.
        embeddedProductImages += 1;
        return {
          ...product,
          imageUrl: embeddedUri!,
        };
      }),
    })),
  };

  const document = buildCataloguePdfDocument(withAbsoluteMedia);
  if (
    document.stats.fallbackProductImages > 0 ||
    document.stats.renderedProductImages !== payload.listedCards
  ) {
    throw new Error(
      `PDF image validation failed: rendered ${document.stats.renderedProductImages} of ` +
        `${payload.listedCards} product images. No incomplete PDF was returned.`
    );
  }

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
      fallbackProductImages: 0,
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

export interface CataloguePdfImageFailure {
  productId: string;
  name: string;
  reason: string;
}

export class CataloguePdfImageError extends Error {
  readonly failures: CataloguePdfImageFailure[];

  constructor(failures: CataloguePdfImageFailure[]) {
    const sample = failures
      .slice(0, 4)
      .map((failure) => `${failure.name} (${failure.productId}): ${failure.reason}`)
      .join("; ");
    const remainder =
      failures.length > 4 ? `; plus ${failures.length - 4} more product(s)` : "";
    super(
      `Catalogue PDF was not generated because ${failures.length} product image(s) ` +
        `could not be loaded. ${sample}${remainder}`
    );
    this.name = "CataloguePdfImageError";
    this.failures = failures;
  }
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
