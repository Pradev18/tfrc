/**
 * One-off verification: parse TFRC_Office_Forms.xlsx and lookup a sample item.
 * Run: npx tsx scripts/test-office-report-parse.ts
 */
import { readFileSync } from "node:fs";
import {
  lookupOfficeFormsFields,
  parseOfficeFormsWorkbook,
} from "../src/lib/report/office-forms-parser";
import { normalizeItemCode } from "../src/lib/report/office-forms-normalize";
import { REPORT_ROWS_PER_PAGE } from "../src/lib/report/office-report-pdf-html";

const path =
  process.argv[2] ||
  "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx";

console.log("Reading", path);
const buffer = readFileSync(path);
console.log("Bytes", buffer.length);

const parsed = parseOfficeFormsWorkbook(buffer);
console.log(
  JSON.stringify(
    {
      inventorySheetName: parsed.inventorySheetName,
      imageSheetName: parsed.imageSheetName,
      iqsSheetName: parsed.iqsSheetName,
      inventoryRowCount: parsed.inventoryRows.length,
      imageLinkCount: parsed.imageLinks.length,
      duplicateInventoryCodes: parsed.duplicateInventoryCodes.slice(0, 10),
      duplicateInventoryCount: parsed.duplicateInventoryCodes.length,
      columnMap: parsed.columnMap,
      sampleHeaders: parsed.inventoryHeaders.slice(0, 20),
      sampleItemCodes: parsed.inventoryRows.slice(0, 5).map((r) => r.itemCode),
      sampleImage: parsed.imageLinks[0] ?? null,
    },
    null,
    2
  )
);

const byCode = new Map<string, typeof parsed.inventoryRows>();
for (const row of parsed.inventoryRows) {
  const list = byCode.get(row.itemCode) ?? [];
  list.push(row);
  byCode.set(row.itemCode, list);
}
const imagesByCode = new Map<string, typeof parsed.imageLinks>();
for (const row of parsed.imageLinks) {
  const list = imagesByCode.get(row.itemCode) ?? [];
  list.push(row);
  imagesByCode.set(row.itemCode, list);
}

const preferred =
  byCode.has("110000049")
    ? "110000049"
    : parsed.inventoryRows.find((r) => imagesByCode.has(r.itemCode))?.itemCode ||
      parsed.inventoryRows[0]?.itemCode;

if (!preferred) {
  throw new Error("No item codes found");
}

const code = normalizeItemCode(preferred);
const fields = lookupOfficeFormsFields(
  parsed,
  byCode.get(code) ?? [],
  imagesByCode.get(code) ?? []
);
console.log("LOOKUP", code, JSON.stringify(fields, null, 2));
console.log("ROWS_PER_PAGE", REPORT_ROWS_PER_PAGE);

// Pagination sanity
for (const n of [1, 10, 11, 20, 21]) {
  const pages = Math.max(1, Math.ceil(n / REPORT_ROWS_PER_PAGE));
  const lastPageRows = n === 0 ? 0 : ((n - 1) % REPORT_ROWS_PER_PAGE) + 1;
  console.log(`pagination ${n} items -> ${pages} page(s), last page ${lastPageRows} row(s)`);
}
