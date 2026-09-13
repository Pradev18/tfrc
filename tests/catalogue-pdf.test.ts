import { describe, expect, it } from "vitest";
import {
  buildCataloguePdfHtml,
  chunkProducts,
  PDF_PRODUCTS_PER_PAGE,
  TFRC_LOGO_SRC,
} from "../src/lib/catalogue-pdf-html";
import type { CataloguePdfPayload } from "../src/services/catalogue-pdf.service";

function baseProduct(overrides: Partial<CataloguePdfPayload["categories"][number]["products"][number]> = {}) {
  return {
    id: "p1",
    name: "Black Pet Hat",
    displayName: "Black Pet Hat",
    productId: "110011577",
    size: "L",
    availableSizes: ["S", "M", "L"] as string[],
    price: 15,
    priceFrom: true,
    currency: "QAR",
    inStock: true,
    imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
    whatsappUrl: "https://wa.me/97455049229?text=hello",
    ...overrides,
  };
}

function basePayload(overrides: Partial<CataloguePdfPayload> = {}): CataloguePdfPayload {
  return {
    catalogue: {
      id: "1",
      name: "PawMart",
      slug: "pawmart",
      logoUrl: "/api/media/pawmart-logo.png",
      tagline: "Everything for your pets",
      description: "Food, grooming, toys and accessories for Qatar.",
    },
    websiteUrl: "https://example.com/pawmart",
    whatsappUrl: "https://wa.me/97455049229",
    whatsappPhone: "97455049229",
    websiteQrDataUrl: "data:image/png;base64,AAA",
    whatsappQrDataUrl: "data:image/png;base64,BBB",
    totalProducts: 3,
    listedCards: 1,
    accent: "#40916c",
    heading: "#141414",
    muted: "#6b6560",
    surface: "#f5f8f6",
    cta: "#1b4332",
    categories: [
      {
        slug: "toys",
        name: "Toys",
        productCount: 3,
        products: [baseProduct()],
      },
    ],
    ...overrides,
  };
}

describe("catalogue PDF pagination", () => {
  it("chunks products into pages of 12", () => {
    const items = Array.from({ length: 100 }, (_, index) => index + 1);
    const pages = chunkProducts(items, PDF_PRODUCTS_PER_PAGE);
    expect(PDF_PRODUCTS_PER_PAGE).toBe(12);
    expect(pages).toHaveLength(9);
    expect(pages[0]).toHaveLength(12);
    expect(pages[8]).toHaveLength(4);
    expect(pages.flat()).toEqual(items);
  });

  it("supports 13 → 12 + 1 and 27 → 12 + 12 + 3", () => {
    expect(chunkProducts(Array.from({ length: 13 }, (_, i) => i))).toEqual([
      Array.from({ length: 12 }, (_, i) => i),
      [12],
    ]);
    const pages27 = chunkProducts(Array.from({ length: 27 }, (_, i) => i));
    expect(pages27.map((p) => p.length)).toEqual([12, 12, 3]);
  });

  it("keeps an empty page placeholder when there are no products", () => {
    expect(chunkProducts([])).toEqual([[]]);
  });
});

describe("catalogue PDF HTML", () => {
  it("embeds catalogue logo, TFRC mark, sizes, and real QR panels", () => {
    const html = buildCataloguePdfHtml(basePayload());
    expect(html).toContain('src="/api/media/pawmart-logo.png"');
    expect(html).toContain(TFRC_LOGO_SRC);
    expect(html).toContain(">S</span>");
    expect(html).toContain(">M</span>");
    expect(html).toContain(">L</span>");
    expect(html).toContain("From QAR 15.00");
    expect(html).toContain("Visit Our Website");
    expect(html).toContain("WhatsApp Orders");
    expect(html).toContain('src="data:image/png;base64,AAA"');
    expect(html).toContain('src="data:image/png;base64,BBB"');
    expect(html).toContain("https://example.com/pawmart");
    expect(html).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(html).toContain("grid-template-rows: repeat(3, minmax(0, 1fr))");
    expect(html).not.toContain("Generated");
    expect(html).not.toContain("height: 82mm");
  });

  it("omits catalogue logo slot content when logo is missing", () => {
    const html = buildCataloguePdfHtml(
      basePayload({
        catalogue: {
          id: "2",
          name: "Pro Tools",
          slug: "hardware",
          logoUrl: null,
          tagline: "Built for the Job",
          description: "Professional tools for Qatar.",
        },
      })
    );
    expect(html).toContain("logo-slot--empty");
    expect(html).not.toContain('class="catalogue-logo"');
    expect(html).toContain(TFRC_LOGO_SRC);
    expect(html).toContain("Pro Tools");
  });

  it("does not treat item codes as sizes", () => {
    const html = buildCataloguePdfHtml(
      basePayload({
        categories: [
          {
            slug: "toys",
            name: "Toys",
            productCount: 1,
            products: [baseProduct({ availableSizes: [], displayName: "Rope Pet Toy", productId: "110009578" })],
          },
        ],
      })
    );
    expect(html).not.toContain('class="size-chip"');
    expect(html).toContain("sizes--empty");
    expect(html).toContain("Rope Pet Toy");
    expect(html).toContain("Item code: 110009578");
  });

  it("renders a full page of 12 product cards in a 4×3 grid", () => {
    const twelve = Array.from({ length: 12 }, (_, index) =>
      baseProduct({
        id: `p${index + 1}`,
        displayName: `Product ${index + 1}`,
        productId: `1100${10000 + index}`,
        availableSizes: [],
        priceFrom: false,
      })
    );
    const html = buildCataloguePdfHtml(
      basePayload({
        totalProducts: 12,
        listedCards: 12,
        categories: [
          {
            slug: "drill",
            name: "Drill",
            productCount: 12,
            products: twelve,
          },
        ],
      })
    );
    expect(html.match(/<article class="card">/g)).toHaveLength(12);
    expect(html).toContain("12 on this page");
    expect(html).toContain("Page 1 of 1");
    for (let i = 1; i <= 12; i++) {
      expect(html).toContain(`Product ${i}`);
    }
  });

  it("paginates 13 cards into two pages without stretching language", () => {
    const thirteen = Array.from({ length: 13 }, (_, index) =>
      baseProduct({
        id: `p${index + 1}`,
        displayName: `Sku ${index + 1}`,
        productId: `X${index}`,
        availableSizes: [],
        priceFrom: false,
      })
    );
    const html = buildCataloguePdfHtml(
      basePayload({
        totalProducts: 13,
        listedCards: 13,
        categories: [
          {
            slug: "leashes-collars",
            name: "Leashes & Collars",
            productCount: 13,
            products: thirteen,
          },
        ],
      })
    );
    expect(html.match(/<article class="card">/g)).toHaveLength(13);
    expect(html).toContain("Page 1 of 2");
    expect(html).toContain("Page 2 of 2");
    expect(html).toContain("12 on this page");
    expect(html).toContain("1 on this page");
  });

  it("handles long product names safely inside cards", () => {
    const html = buildCataloguePdfHtml(
      basePayload({
        categories: [
          {
            slug: "toys",
            name: "Toys",
            productCount: 1,
            products: [
              baseProduct({
                displayName:
                  "Pet Retractable Leash Cord Mix Color 5M 20Kg Max Extra Long Title",
                availableSizes: [],
              }),
            ],
          },
        ],
      })
    );
    expect(html).toContain("max-height: 2.5em");
    expect(html).toContain("Pet Retractable Leash Cord Mix Color 5M 20Kg Max Extra Long Title");
  });
});
