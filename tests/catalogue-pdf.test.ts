import { describe, expect, it } from "vitest";
import {
  buildCataloguePdfHtml,
  chunkProducts,
  PDF_PRODUCTS_PER_PAGE,
} from "../src/lib/catalogue-pdf-html";
import type { CataloguePdfPayload } from "../src/services/catalogue-pdf.service";

describe("catalogue PDF pagination", () => {
  it("chunks products into pages of 9", () => {
    const items = Array.from({ length: 100 }, (_, index) => index + 1);
    const pages = chunkProducts(items, PDF_PRODUCTS_PER_PAGE);
    expect(pages).toHaveLength(12);
    expect(pages[0]).toHaveLength(9);
    expect(pages[11]).toHaveLength(1);
    expect(pages.flat()).toEqual(items);
  });

  it("keeps an empty page placeholder when there are no products", () => {
    expect(chunkProducts([])).toEqual([[]]);
  });
});

describe("catalogue PDF HTML", () => {
  const payload: CataloguePdfPayload = {
    catalogue: {
      id: "1",
      name: "PawMart",
      slug: "pawmart",
      logoUrl: "/api/media/pawmart-logo.png",
      tagline: "Everything for your pets",
    },
    whatsappUrl: "https://wa.me/97455049229",
    generatedAt: "2026-09-09T00:00:00.000Z",
    totalProducts: 3,
    listedCards: 1,
    accent: "#40916c",
    heading: "#141414",
    muted: "#6b6560",
    surface: "#f5f8f6",
    categories: [
      {
        slug: "toys",
        name: "Toys",
        productCount: 3,
        products: [
          {
            id: "p1",
            name: "Black Pet Hat",
            displayName: "Black Pet Hat",
            productId: "110011577",
            size: "L",
            availableSizes: ["S", "M", "L"],
            price: 15,
            priceFrom: true,
            currency: "QAR",
            inStock: true,
            imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
            whatsappUrl: "https://wa.me/97455049229",
          },
        ],
      },
    ],
  };

  it("embeds uploaded logo and available size chips", () => {
    const html = buildCataloguePdfHtml(payload);
    expect(html).toContain('src="/api/media/pawmart-logo.png"');
    expect(html).toContain("Available sizes");
    expect(html).toContain(">S</span>");
    expect(html).toContain(">M</span>");
    expect(html).toContain(">L</span>");
    expect(html).toContain("From QAR 15.00");
    expect(html).toContain("by TFRC");
    expect(html).toContain("The Products count matches your Excel");
    expect(html).toContain("<strong>3</strong>");
  });

  it("does not treat item codes as sizes", () => {
    const skuPayload: CataloguePdfPayload = {
      ...payload,
      categories: [
        {
          slug: "toys",
          name: "Toys",
          productCount: 1,
          products: [
            {
              ...payload.categories[0]!.products[0]!,
              availableSizes: [],
              displayName: "Rope Pet Toy",
              productId: "110009578",
            },
          ],
        },
      ],
    };
    const html = buildCataloguePdfHtml(skuPayload);
    expect(html).not.toContain("Available sizes");
    expect(html).toContain("Rope Pet Toy");
    expect(html).toContain("Item code 110009578");
  });

  it("renders a full page of 9 product cards without fixed overflow heights", () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      ...payload.categories[0]!.products[0]!,
      id: `p${index + 1}`,
      displayName: `Product ${index + 1}`,
      productId: `1100${10000 + index}`,
    }));
    const fullPage: CataloguePdfPayload = {
      ...payload,
      totalProducts: 9,
      listedCards: 9,
      categories: [
        {
          slug: "drill",
          name: "Drill",
          productCount: 9,
          products: nine,
        },
      ],
    };
    const html = buildCataloguePdfHtml(fullPage);
    expect(html.match(/<article class="card">/g)).toHaveLength(9);
    expect(html).toContain("grid-template-rows: repeat(3, minmax(0, 1fr))");
    expect(html).not.toContain("height: 82mm");
    for (let i = 1; i <= 9; i++) {
      expect(html).toContain(`Product ${i}`);
    }
  });
});
