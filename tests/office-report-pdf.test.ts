import { describe, expect, it } from "vitest";
import {
  buildOfficeReportPdfHtml,
  REPORT_ROWS_PER_PAGE,
} from "@/lib/report/office-report-pdf-html";
import {
  findHeaderIndex,
  normalizeHeader,
  normalizeItemCode,
} from "@/lib/report/office-forms-normalize";
import { lookupOfficeFormsFields } from "@/lib/report/office-forms-parser";

function fakeReport(lineCount: number) {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    id: `line-${i}`,
    sortOrder: i + 1,
    itemCode: `1100000${i}`,
    imageLink: `https://example.com/img/${i}.jpg`,
    itemName: `Long product name ${i} `.repeat(4).trim(),
    supplierName: `Supplier ${i}`,
    onHand: String(i * 3),
    itemCost: "10.50",
    sellingPrice: "25.00",
    wholesalePriceApproval: i === 0 ? "20" : "",
    lookupStatus: "ok",
    lookupWarning: null,
  }));

  return {
    id: "report-1",
    title: "Inventory Availability & Price Check",
    customerName: "",
    requestedBy: "",
    shopBranch: "",
    tfrcLabel: "TFRC",
    notes: "",
    reportDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    import: {
      id: "import-1",
      fileName: "workbook.xlsx",
      status: "READY",
      inventorySheetName: "Item_Qty_in_Store",
      imageSheetName: "Cloud Fare",
      iqsSheetName: "Inventory Price Check (I.Q.S)",
      inventoryRowCount: 100,
      imageLinkCount: 50,
      duplicateItemCodes: [],
      columnMap: {
        itemCode: "Item Code",
        description: "Description",
        supplierName: "Supplier Name",
        itemCost: "Item Cost",
        retailPrice: "Retail Price",
        onHand: "BOH",
      },
    },
    lines,
  };
}

describe("office report PDF", () => {
  it("uses exactly 10 rows per page", () => {
    expect(REPORT_ROWS_PER_PAGE).toBe(10);
  });

  it.each([
    [1, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 3],
  ])("paginates %i lines into %i pages", (lineCount, expectedPages) => {
    const html = buildOfficeReportPdfHtml(fakeReport(lineCount));
    const sheets = html.match(/class="sheet"/g) ?? [];
    expect(sheets).toHaveLength(expectedPages);
    expect(html).toContain(`Page 1 of ${expectedPages}`);
    expect(html).toContain(`Page ${expectedPages} of ${expectedPages}`);
    expect(html.match(/PREPARED BY/g)).toHaveLength(1);
    expect(html).toContain("@page { size: A4 portrait; margin: 0; }");
    expect(html).toContain('href="https://example.com/img/0.jpg"');
    expect(html).toContain("الشركة الأولى لبيع التجزئة (ذ.م.م)");
    expect(html).not.toContain("Enter customer");
    expect(html).not.toContain("DD-MM-YYYY");
    expect(html).not.toContain("Type here");
  });
});

describe("normalizeItemCode", () => {
  it("preserves long numeric codes as strings", () => {
    expect(normalizeItemCode(110000049)).toBe("110000049");
    expect(normalizeItemCode("110000049")).toBe("110000049");
    expect(normalizeItemCode(" 110000049 ")).toBe("110000049");
    expect(normalizeItemCode('"110000049"')).toBe("110000049");
  });
});

describe("findHeaderIndex", () => {
  const headers = [
    "Item Code",
    "Description",
    "Supplier Name",
    "Item Cost",
    "Retail Price",
    "BOH",
    "Total Qty",
  ];

  it("maps I.Q.S source columns unambiguously", () => {
    expect(headers[findHeaderIndex(headers, ["item code"])]).toBe("Item Code");
    expect(headers[findHeaderIndex(headers, ["description", "item name"])]).toBe("Description");
    expect(headers[findHeaderIndex(headers, ["supplier name"])]).toBe("Supplier Name");
    expect(headers[findHeaderIndex(headers, ["item cost"])]).toBe("Item Cost");
    expect(headers[findHeaderIndex(headers, ["retail price", "selling price"])]).toBe(
      "Retail Price"
    );
    expect(headers[findHeaderIndex(headers, ["boh", "on hand", "total qty"])]).toBe("BOH");
  });

  it("does not fuzzy-map short fragments into the wrong column", () => {
    expect(findHeaderIndex(headers, ["cost"])).toBe(-1);
    expect(normalizeHeader("Item Cost")).toBe("item cost");
  });
});

describe("lookupOfficeFormsFields placement", () => {
  const columnMap = {
    itemCode: "Item Code",
    description: "Description",
    supplierName: "Supplier Name",
    itemCost: "Item Cost",
    retailPrice: "Retail Price",
    onHand: "BOH",
  };

  it("places each Excel VLOOKUP field into the correct I.Q.S column", () => {
    const fields = lookupOfficeFormsFields(
      { columnMap },
      [
        {
          itemCode: "110000049",
          payload: {
            "Item Code": "110000049",
            Description: "COMPRESSOR KIT TWIN PORTABLE 12V",
            "Supplier Name": "ARB Corporation",
            "Item Cost": "1671.8906",
            "Retail Price": "2680",
            BOH: "198",
          },
        },
      ],
      [
        {
          itemCode: "110000049",
          imageUrl:
            "https://pub-c34decbe8eba4a2fa17498e94b1d07b5.r2.dev/catalog/Batch-001/110000049.jpg",
        },
      ]
    );

    expect(fields.itemName).toBe("COMPRESSOR KIT TWIN PORTABLE 12V");
    expect(fields.supplierName).toBe("ARB Corporation");
    expect(fields.onHand).toBe("198");
    expect(fields.itemCost).toBe("1,671.89");
    expect(fields.sellingPrice).toBe("2,680.00");
    expect(fields.imageLink).toContain("110000049.jpg");
    expect(fields.lookupStatus).toBe("ok");
  });

  it("marks duplicate only for inventory duplicates, not multi-format images", () => {
    const fields = lookupOfficeFormsFields(
      { columnMap },
      [
        {
          itemCode: "88006680",
          payload: {
            Description: "Sample",
            "Supplier Name": "X",
            "Item Cost": "1",
            "Retail Price": "2",
            BOH: "3",
          },
        },
      ],
      [
        { itemCode: "88006680", imageUrl: "https://example.com/a.jpg" },
        { itemCode: "88006680", imageUrl: "https://example.com/a.png" },
      ]
    );
    expect(fields.lookupStatus).toBe("ok");
    expect(fields.imageLink).toBe("https://example.com/a.jpg");
    expect(fields.lookupWarning).toMatch(/Multiple image links/);
  });

  it("uses first inventory row for duplicates and flags status", () => {
    const fields = lookupOfficeFormsFields(
      { columnMap },
      [
        {
          itemCode: "DUP",
          payload: {
            Description: "First",
            "Supplier Name": "A",
            "Item Cost": "1",
            "Retail Price": "2",
            BOH: "1",
          },
        },
        {
          itemCode: "DUP",
          payload: {
            Description: "Second",
            "Supplier Name": "B",
            "Item Cost": "9",
            "Retail Price": "9",
            BOH: "9",
          },
        },
      ],
      []
    );
    expect(fields.itemName).toBe("First");
    expect(fields.lookupStatus).toBe("duplicate");
  });
});
