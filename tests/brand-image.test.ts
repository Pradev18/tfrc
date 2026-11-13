import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseExcelBuffer,
  rowImages,
} from "../src/lib/import/catalog-parser";
import { META_CATALOGUE_TEMPLATE_HEADERS } from "../src/lib/import/meta-catalogue-template";
import { META_CATALOGUE_HEADERS } from "../src/lib/import/meta-excel-template";
import { brandInitial, brandAvatarTone } from "../src/lib/brand-avatar";

function workbookBuffer(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Meta Catalogue"
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("brand_image production readiness", () => {
  it("keeps brand_image out of product image lists", () => {
    const parsed = parseExcelBuffer(
      workbookBuffer([
        {
          id: "P1",
          title: "Item",
          price: "QAR 10",
          image_link: "https://cdn.example/product.jpg",
          additional_image_link: "https://cdn.example/extra.jpg",
          brand: "Levi",
          brand_image: "https://cdn.example/levi.png",
        },
      ]),
      "Test"
    );
    expect(parsed.errors).toEqual([]);
    expect(rowImages(parsed.rows[0])).toEqual([
      "https://cdn.example/product.jpg",
      "https://cdn.example/extra.jpg",
    ]);
    expect(rowImages(parsed.rows[0])).not.toContain("https://cdn.example/levi.png");
  });

  it("accepts brand_logo alias and ignores non-http brand cells", () => {
    const parsed = parseExcelBuffer(
      workbookBuffer([
        {
          id: "P2",
          title: "Item",
          price: "10",
          image_link: "https://cdn.example/p.jpg",
          brand: "Nike",
          brand_logo: "https://cdn.example/nike.svg",
        },
        {
          id: "P3",
          title: "Item 2",
          price: "10",
          image_link: "https://cdn.example/p2.jpg",
          brand: "Adidas",
          brand_image: "not-a-url",
        },
      ]),
      "Test"
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].brand_image).toBe("https://cdn.example/nike.svg");
    expect(parsed.rows[1].brand_image).toBe("");
  });

  it("templates expose brand_image next to brand", () => {
    expect(META_CATALOGUE_TEMPLATE_HEADERS).toContain("brand");
    expect(META_CATALOGUE_TEMPLATE_HEADERS).toContain("brand_image");
    expect(META_CATALOGUE_HEADERS).toContain("brand_image");
    const brandIdx = META_CATALOGUE_TEMPLATE_HEADERS.indexOf("brand");
    const imageIdx = META_CATALOGUE_TEMPLATE_HEADERS.indexOf("brand_image");
    expect(imageIdx).toBe(brandIdx + 1);
  });

  it("letter avatars are stable and uppercase", () => {
    expect(brandInitial("levi")).toBe("L");
    expect(brandInitial("AAA")).toBe("A");
    expect(brandInitial("")).toBe("?");
    const a = brandAvatarTone("Levi");
    const b = brandAvatarTone("Levi");
    expect(a).toEqual(b);
    expect(a.bg).toMatch(/^hsl\(/);
  });
});
