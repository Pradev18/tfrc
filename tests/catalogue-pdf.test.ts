import { describe, expect, it } from "vitest";
import {
  buildCataloguePdfDocument,
  chunkCatalogueProducts,
  PDF_PRODUCTS_PER_PAGE,
} from "../src/lib/catalogue-pdf-document";
import {
  assembleCataloguePdfDocument,
  CataloguePdfImageError,
} from "../src/lib/catalogue-pdf-build";
import type { CataloguePdfPayload } from "../src/services/catalogue-pdf.service";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function product(index: number, overrides = {}) {
  return {
    id: `product-${index}`,
    name: `Product ${index}`,
    displayName: `Product ${index}`,
    productId: `SKU-${index}`,
    size: null,
    availableSizes: [] as string[],
    price: index + 0.5,
    priceFrom: false,
    currency: "QAR",
    inStock: true,
    imageUrl: TINY_PNG,
    whatsappUrl: `https://wa.me/9745000${String(index).padStart(4, "0")}?text=Product%20${index}`,
    ...overrides,
  };
}

function payload(
  categorySizes: number[] = [1],
  overrides: Partial<CataloguePdfPayload> = {}
): CataloguePdfPayload {
  const categories = categorySizes.map((size, categoryIndex) => ({
    slug: `category-${categoryIndex + 1}`,
    name: `Category ${categoryIndex + 1}`,
    productCount: size,
    products: Array.from({ length: size }, (_, index) =>
      product(categoryIndex * 10_000 + index + 1)
    ),
  }));
  const listedCards = categorySizes.reduce((sum, size) => sum + size, 0);
  return {
    catalogue: {
      id: "fixture-id",
      name: "Future Catalogue",
      slug: "future-catalogue",
      logoUrl: TINY_PNG,
      tagline: "Data-driven product range",
      description: "A fixture that uses the same production PDF renderer.",
    },
    websiteUrl: "https://tfrcwholesale.com/future-catalogue",
    whatsappUrl: "https://api.whatsapp.com/send/?phone=97450000000&text=Hello",
    whatsappPhone: "97450000000",
    websiteQrDataUrl: TINY_PNG,
    whatsappQrDataUrl: TINY_PNG,
    totalProducts: listedCards,
    listedCards,
    accent: "#40916c",
    heading: "#141414",
    muted: "#6b6560",
    surface: "#f5f8f6",
    cta: "#1b4332",
    categories,
    ...overrides,
  };
}

function pdfSource(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

function physicalPageCount(bytes: Uint8Array): number {
  return pdfSource(bytes).match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

function linkAnnotationCount(bytes: Uint8Array): number {
  return pdfSource(bytes).match(/\/Subtype\s*\/Link\b/g)?.length ?? 0;
}

describe("catalogue PDF pagination", () => {
  it("chunks actual cards into pages of 12 without creating an empty page", () => {
    const items = Array.from({ length: 27 }, (_, index) => index);
    expect(PDF_PRODUCTS_PER_PAGE).toBe(12);
    expect(chunkCatalogueProducts(items).map((page) => page.length)).toEqual([
      12, 12, 3,
    ]);
    expect(chunkCatalogueProducts([])).toEqual([]);
  });

  it("builds the Home & Living regression shape as exactly six physical pages", () => {
    const result = buildCataloguePdfDocument(payload([47, 4]));
    expect(result.stats.pageCount).toBe(6);
    expect(result.stats.pageCardCounts).toEqual([12, 12, 12, 11, 4]);
    expect(result.stats.productCards).toBe(51);
    expect(physicalPageCount(result.bytes)).toBe(6);
  });

  it("handles 13 cards as 12 + 1 and stops", () => {
    const result = buildCataloguePdfDocument(payload([13]));
    expect(result.stats.pageCardCounts).toEqual([12, 1]);
    expect(result.stats.pageCount).toBe(3);
    expect(physicalPageCount(result.bytes)).toBe(3);
  });

  it("supports zero cards with a one-page cover and no empty category page", () => {
    const result = buildCataloguePdfDocument(payload([0]));
    expect(result.stats.pageCount).toBe(1);
    expect(result.stats.productPages).toBe(0);
    expect(result.stats.pageCardCounts).toEqual([]);
    expect(physicalPageCount(result.bytes)).toBe(1);
  });

  it("uses deterministic pagination for 1000 cards", () => {
    const result = buildCataloguePdfDocument(payload([1000]));
    expect(result.stats.productPages).toBe(84);
    expect(result.stats.pageCount).toBe(85);
    expect(result.stats.pageCardCounts.at(-1)).toBe(4);
    expect(physicalPageCount(result.bytes)).toBe(85);
  }, 30_000);

  it("keeps a data-driven category index while skipping no populated category", () => {
    const categorySizes = Array.from({ length: 31 }, () => 1);
    const result = buildCataloguePdfDocument(payload(categorySizes));
    expect(result.stats.productPages).toBe(31);
    expect(result.stats.productCards).toBe(31);
    expect(result.stats.pageCount).toBe(32);
    expect(physicalPageCount(result.bytes)).toBe(32);
  });
});

describe("catalogue PDF links and assets", () => {
  it("writes real PDF link annotations for both cover links and every card", () => {
    const result = buildCataloguePdfDocument(payload([3]));
    const source = pdfSource(result.bytes);
    expect(result.stats.linkAnnotations).toBe(5);
    expect(linkAnnotationCount(result.bytes)).toBe(5);
    expect(source).toContain("/URI (https://tfrcwholesale.com/future-catalogue)");
    expect(source).toContain("/URI (https://wa.me/9745000");
    expect(result.stats.renderedProductImages).toBe(3);
    expect(result.stats.fallbackProductImages).toBe(0);
  });

  it("uses each catalogue's supplied WhatsApp URLs without hardcoding", () => {
    const first = buildCataloguePdfDocument(
      payload([1], {
        whatsappPhone: "97451111111",
        whatsappUrl: "https://wa.me/97451111111?text=Cover%20A",
        categories: [
          {
            slug: "a",
            name: "A",
            productCount: 1,
            products: [
              product(1, {
                whatsappUrl: "https://wa.me/97451111111?text=Card%20A",
              }),
            ],
          },
        ],
      })
    );
    const second = buildCataloguePdfDocument(
      payload([1], {
        whatsappPhone: "97452222222",
        whatsappUrl: "https://wa.me/97452222222?text=Cover%20B",
        categories: [
          {
            slug: "b",
            name: "B",
            productCount: 1,
            products: [
              product(2, {
                whatsappUrl: "https://wa.me/97452222222?text=Card%20B",
              }),
            ],
          },
        ],
      })
    );
    expect(pdfSource(first.bytes)).toContain("97451111111");
    expect(pdfSource(first.bytes)).not.toContain("97452222222");
    expect(pdfSource(second.bytes)).toContain("97452222222");
    expect(pdfSource(second.bytes)).not.toContain("97451111111");
  });

  it("applies a controlled fallback without losing the card or its link", () => {
    const fixture = payload([1]);
    fixture.categories[0]!.products[0]!.imageUrl =
      "data:image/svg+xml;charset=utf-8,%3Csvg/%3E";
    const result = buildCataloguePdfDocument(fixture);
    expect(result.stats.fallbackImages).toBeGreaterThanOrEqual(1);
    expect(result.stats.fallbackProductImages).toBe(1);
    expect(result.stats.productCards).toBe(1);
    expect(result.stats.linkAnnotations).toBe(3);
    expect(physicalPageCount(result.bytes)).toBe(2);
  });

  it("refuses to return an assembled PDF when any product has no image", async () => {
    const fixture = payload([1]);
    fixture.categories[0]!.products[0]!.imageUrl = null;

    await expect(
      assembleCataloguePdfDocument(fixture, { origin: "https://example.test" })
    ).rejects.toBeInstanceOf(CataloguePdfImageError);
  });

  it("uses a validated alternate image when the primary source is broken", async () => {
    const fixture = payload([1]);
    const item = fixture.categories[0]!.products[0]!;
    item.imageUrl = "data:image/jpeg;base64,bm90LWFuLWltYWdl";
    item.imageUrls = [item.imageUrl, TINY_PNG];

    const result = await assembleCataloguePdfDocument(fixture, {
      origin: "https://example.test",
    });

    expect(result.stats.embeddedProductImages).toBe(1);
    expect(result.stats.fallbackProductImages).toBe(0);
    expect(result.stats.renderedFallbacks).toBe(0);
  });

  it("emits true A4 pages and never contains browser print code", () => {
    const result = buildCataloguePdfDocument(payload([1]));
    const source = pdfSource(result.bytes);
    expect(source).toMatch(/\/MediaBox\s*\[0 0 595\.\d+ 841\.\d+\]/);
    expect(source).not.toContain("window.print");
    expect(source).not.toContain("setTimeout");
  });
});
