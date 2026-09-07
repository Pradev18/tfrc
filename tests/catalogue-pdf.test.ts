import { describe, expect, it } from "vitest";
import { chunkProducts, PDF_PRODUCTS_PER_PAGE } from "../src/lib/catalogue-pdf-html";

describe("catalogue PDF pagination", () => {
  it("chunks products into pages of 12", () => {
    const items = Array.from({ length: 100 }, (_, index) => index + 1);
    const pages = chunkProducts(items, PDF_PRODUCTS_PER_PAGE);
    expect(pages).toHaveLength(9);
    expect(pages[0]).toHaveLength(12);
    expect(pages[8]).toHaveLength(4);
    expect(pages.flat()).toEqual(items);
  });

  it("keeps an empty page placeholder when there are no products", () => {
    expect(chunkProducts([])).toEqual([[]]);
  });
});
