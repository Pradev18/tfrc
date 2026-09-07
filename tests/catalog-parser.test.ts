import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "../src/lib/import/catalog-parser";
import { buildMetaCatalogueTemplateBuffer } from "../src/lib/import/meta-catalogue-template";

function workbookBuffer(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Meta Catalogue"
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("Meta catalogue Excel validation", () => {
  it("accepts a valid Meta catalogue sheet", () => {
    const parsed = parseExcelBuffer(
      workbookBuffer([
        {
          id: "META-1",
          title: "Test product",
          price: "QAR 20.00",
          image_link: "https://example.com/product.jpg",
          availability: "in stock",
          brand: "Test",
        },
      ]),
      "Test catalogue"
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("META-1");
  });

  it("reports a clear format error for a non-Meta spreadsheet", () => {
    const parsed = parseExcelBuffer(
      workbookBuffer([{ product: "Unknown", cost: 20 }]),
      "Test catalogue"
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain("not a supported Meta catalogue Excel sheet");
    expect(parsed.errors[0].message).toContain("id, title, price, image_link");
  });

  it("parses the downloadable PawMart Excel template and ignores empty edit rows", () => {
    const parsed = parseExcelBuffer(buildMetaCatalogueTemplateBuffer(), "PawMart");
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((row) => row.id)).toEqual([
      "TFRC-PM-EXAMPLE-001",
      "TFRC-PM-EXAMPLE-002",
      "TFRC-PM-EXAMPLE-003",
    ]);
    expect(parsed.rows[0].title).toContain("Black Pet Hat");
    expect(parsed.rows[0].size).toBe("L");
  });
});
