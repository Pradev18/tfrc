/**
 * Accuracy harness: compare app lookup to Excel I.Q.S cached formula values.
 * Also stress-tests CRUD, PDF pagination, duplicates, missing codes, isolation.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import {
  lookupOfficeFormsFields,
  parseOfficeFormsWorkbook,
} from "../src/lib/report/office-forms-parser";
import { normalizeItemCode } from "../src/lib/report/office-forms-normalize";
import {
  addOfficeReportLine,
  createOfficeReportImport,
  deleteOfficeReport,
  getOfficeReportDetail,
  seedOfficeReportLinesBatch,
  searchOfficeItemCodes,
  updateOfficeReportLine,
  updateOfficeReportMeta,
} from "../src/services/office-report.service";
import {
  buildOfficeReportPdfHtml,
  REPORT_ROWS_PER_PAGE,
} from "../src/lib/report/office-report-pdf-html";
import prisma from "../src/lib/db";

const PATH =
  process.argv[2] ||
  "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx";

type Issue = { level: "error" | "warn"; msg: string };
const issues: Issue[] = [];

function err(msg: string) {
  issues.push({ level: "error", msg });
  console.error("ERROR:", msg);
}
function warn(msg: string) {
  issues.push({ level: "warn", msg });
  console.warn("WARN:", msg);
}
function ok(msg: string) {
  console.log("OK:", msg);
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v).trim();
}

function moneyish(v: string): string {
  if (!v) return "";
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function nearlyEqualMoney(a: string, b: string): boolean {
  const na = Number(String(a).replace(/,/g, ""));
  const nb = Number(String(b).replace(/,/g, ""));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a.trim() === b.trim();
  return Math.abs(na - nb) < 0.015;
}

async function main() {
  console.log("=== ACCURACY AUDIT ===");
  const buffer = readFileSync(PATH);

  // 1) Parse workbook with app parser
  const parsed = parseOfficeFormsWorkbook(buffer);
  ok(
    `sheets: inv=${parsed.inventorySheetName} img=${parsed.imageSheetName} iqs=${parsed.iqsSheetName}`
  );
  ok(`rows inventory=${parsed.inventoryRows.length} images=${parsed.imageLinks.length}`);
  console.log("columnMap", parsed.columnMap);

  if (parsed.inventorySheetName !== "Item_Qty_in_Store") {
    err(`Expected inventory sheet Item_Qty_in_Store, got ${parsed.inventorySheetName}`);
  }
  if (parsed.imageSheetName !== "Cloud Fare") {
    err(`Expected image sheet Cloud Fare, got ${parsed.imageSheetName}`);
  }
  if (parsed.iqsSheetName !== "Inventory Price Check (I.Q.S)") {
    err(`Expected I.Q.S sheet, got ${parsed.iqsSheetName}`);
  }

  // Expected VLOOKUP indexes from Excel E$10..I$10
  const expectedIdx = {
    description: 3,
    supplierName: 6,
    onHand: 49,
    itemCost: 10,
    retailPrice: 11,
  };
  for (const [k, v] of Object.entries(expectedIdx)) {
    const got = parsed.columnMap.vlookupIndexes?.[k as keyof typeof expectedIdx];
    if (got !== v) err(`VLOOKUP index ${k}: expected ${v}, got ${got}`);
    else ok(`VLOOKUP index ${k}=${v}`);
  }

  // 2) Read Excel I.Q.S cached values directly for comparison
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
  const iqs = wb.Sheets["Inventory Price Check (I.Q.S)"];
  if (!iqs) throw new Error("I.Q.S sheet missing from raw workbook");

  // Row 10 holds column indexes used by formulas
  const idxRow = [10, 11].map((c) => {
    // columns E..J are 5..10
    return null;
  });
  const e10 = iqs["E10"]?.v;
  const f10 = iqs["F10"]?.v;
  const g10 = iqs["G10"]?.v;
  const h10 = iqs["H10"]?.v;
  const i10 = iqs["I10"]?.v;
  const j10 = iqs["J10"]?.v;
  console.log("Excel row10 indexes", { e10, f10, g10, h10, i10, j10 });
  if (Number(e10) !== 3) err(`Excel E10 expected 3 got ${e10}`);
  if (Number(f10) !== 6) err(`Excel F10 expected 6 got ${f10}`);
  if (Number(g10) !== 49) err(`Excel G10 expected 49 (BOH) got ${g10}`);
  if (Number(h10) !== 10) err(`Excel H10 expected 10 got ${h10}`);
  if (Number(i10) !== 11) err(`Excel I10 expected 11 got ${i10}`);

  // Index app inventory + images
  const invByCode = new Map<string, typeof parsed.inventoryRows>();
  for (const row of parsed.inventoryRows) {
    const list = invByCode.get(row.itemCode) ?? [];
    list.push(row);
    invByCode.set(row.itemCode, list);
  }
  const imgByCode = new Map<string, typeof parsed.imageLinks>();
  for (const row of parsed.imageLinks) {
    const list = imgByCode.get(row.itemCode) ?? [];
    list.push(row);
    imgByCode.set(row.itemCode, list);
  }

  // I.Q.S data rows typically start at row 12
  const comparisons: Array<Record<string, unknown>> = [];
  for (let r = 12; r <= 40; r++) {
    const code = normalizeItemCode(iqs[`B${r}`]?.v);
    if (!code) continue;
    const excel = {
      code,
      imageLink: cellStr(iqs[`C${r}`]?.v),
      itemName: cellStr(iqs[`E${r}`]?.v),
      supplierName: cellStr(iqs[`F${r}`]?.v),
      onHand: cellStr(iqs[`G${r}`]?.v),
      itemCost: cellStr(iqs[`H${r}`]?.v),
      sellingPrice: cellStr(iqs[`I${r}`]?.v),
    };
    // Skip blank formula results
    if (!excel.itemName && !excel.supplierName && excel.imageLink === "") continue;

    const fields = lookupOfficeFormsFields(
      parsed,
      invByCode.get(code) ?? [],
      imgByCode.get(code) ?? []
    );

    const rowIssues: string[] = [];
    if (fields.itemName.trim() !== excel.itemName.trim()) {
      rowIssues.push(`name app="${fields.itemName}" excel="${excel.itemName}"`);
    }
    if (fields.supplierName.trim() !== excel.supplierName.trim()) {
      rowIssues.push(`supplier app="${fields.supplierName}" excel="${excel.supplierName}"`);
    }
    if (fields.onHand.trim() !== excel.onHand.trim()) {
      rowIssues.push(`onHand app="${fields.onHand}" excel="${excel.onHand}"`);
    }
    if (!nearlyEqualMoney(fields.itemCost, moneyish(excel.itemCost))) {
      rowIssues.push(`cost app="${fields.itemCost}" excel="${excel.itemCost}"`);
    }
    if (!nearlyEqualMoney(fields.sellingPrice, moneyish(excel.sellingPrice))) {
      rowIssues.push(`sell app="${fields.sellingPrice}" excel="${excel.sellingPrice}"`);
    }
    // Image: Excel may have trailing space from IFERROR; normalize
    const excelLink = excel.imageLink.trim();
    if (excelLink && excelLink !== " " && fields.imageLink !== excelLink) {
      // Prefer exact URL match; if app picked jpg over jpeg etc, still check same item code in URL
      const appHasCode = fields.imageLink.includes(code);
      const excelHasCode = excelLink.includes(code);
      if (!(appHasCode && excelHasCode)) {
        rowIssues.push(`image app="${fields.imageLink}" excel="${excelLink}"`);
      } else if (fields.imageLink !== excelLink) {
        warn(`image URL differs but same item ${code}: app=${fields.imageLink} excel=${excelLink}`);
      }
    }
    if (fields.lookupStatus === "not_found") {
      rowIssues.push("lookup not_found");
    }

    comparisons.push({ code, ok: rowIssues.length === 0, rowIssues, fields, excel });
    if (rowIssues.length) err(`Mismatch ${code}: ${rowIssues.join("; ")}`);
    else ok(`match ${code}`);
  }

  // 3) Full DB e2e with accurate placement
  console.log("\n=== DB E2E ===");
  const { report, importRecord } = await createOfficeReportImport({
    fileName: "TFRC_Office_Forms.xlsx",
    fileSize: buffer.length,
    buffer,
    userId: null,
  });

  while (true) {
    const batch = await seedOfficeReportLinesBatch(report.id);
    if (batch.done) break;
  }

  // Use first 12 I.Q.S codes for multi-page sample checks
  const iqsCodes = comparisons.map((c) => String(c.code)).slice(0, 12);
  if (iqsCodes.length < 11) {
    iqsCodes.push("110000049", "110000050", "110000051");
  }

  // Lines are already seeded from unique inventory — verify I.Q.S codes exist.
  {
    const seeded = await getOfficeReportDetail(report.id, { page: 1, pageSize: 1 });
    if (!seeded || seeded.lineCount < 1000) {
      err(`Expected large unique seed, got ${seeded?.lineCount}`);
    } else ok(`seeded ${seeded.lineCount} unique lines`);
  }

  await updateOfficeReportMeta(report.id, {
    customerName: "Test Customer LLC",
    requestedBy: "Accuracy Suite",
    shopBranch: "Rahal",
    notes: "Accuracy audit notes",
    reportDate: "15-Sep-26",
  });

  let detail = await getOfficeReportDetail(report.id, { page: 1, pageSize: 200 });
  if (!detail) throw new Error("report missing");

  // Verify I.Q.S comparison codes exist among seeded lines (page through if needed)
  const byCode = new Map(detail.lines.map((l) => [l.itemCode, l]));
  for (const code of iqsCodes) {
    if (byCode.has(code)) continue;
    // Not on first page — resolve via add would duplicate; use inventory search + skip
    const found = await prisma.officeReportLine.findFirst({
      where: { reportId: report.id, itemCode: code },
    });
    if (!found) err(`Missing seeded line for I.Q.S code ${code}`);
    else byCode.set(code, found as typeof detail.lines[0]);
  }

  // Verify each overlapping I.Q.S code matches Excel comparison
  for (const code of iqsCodes) {
    const line = byCode.get(code);
    if (!line) continue;
    const excelRow = comparisons.find((c) => c.code === code) as
      | { excel: Record<string, string>; code: string }
      | undefined;
    if (!excelRow) continue;
    const excel = excelRow.excel;
    if (line.itemName.trim() !== excel.itemName.trim()) {
      err(`DB line name mismatch ${line.itemCode}`);
    }
    if (line.supplierName.trim() !== excel.supplierName.trim()) {
      err(`DB line supplier mismatch ${line.itemCode}`);
    }
    if (line.onHand.trim() !== excel.onHand.trim()) {
      err(`DB line onHand mismatch ${line.itemCode}`);
    }
    if (!nearlyEqualMoney(line.itemCost, moneyish(excel.itemCost))) {
      err(`DB line cost mismatch ${line.itemCode}: ${line.itemCost} vs ${excel.itemCost}`);
    }
    if (!nearlyEqualMoney(line.sellingPrice, moneyish(excel.sellingPrice))) {
      err(`DB line sell mismatch ${line.itemCode}`);
    }
  }
  ok("DB lines match Excel for overlapping I.Q.S codes");

  // Meta persisted
  if (
    detail.customerName !== "Test Customer LLC" ||
    detail.requestedBy !== "Accuracy Suite" ||
    detail.shopBranch !== "Rahal" ||
    detail.notes !== "Accuracy audit notes" ||
    detail.reportDate !== "15-Sep-26"
  ) {
    err("Meta fields not persisted correctly");
  } else ok("meta fields persisted");

  // Wholesale edit must not mutate source fields
  const first = detail.lines[0]!;
  const snap = { ...first };
  await updateOfficeReportLine(report.id, first.id, { wholesalePriceApproval: "999.50" });
  detail = (await getOfficeReportDetail(report.id))!;
  const after = detail.lines[0]!;
  if (
    after.itemName !== snap.itemName ||
    after.supplierName !== snap.supplierName ||
    after.onHand !== snap.onHand ||
    after.itemCost !== snap.itemCost ||
    after.sellingPrice !== snap.sellingPrice ||
    after.imageLink !== snap.imageLink
  ) {
    err("Wholesale edit mutated source-derived fields");
  }
  if (after.wholesalePriceApproval !== "999.50") err("Wholesale not saved");
  else ok("wholesale editable; source immutable");

  // Search
  const search = await searchOfficeItemCodes(importRecord.id, "11000004", 10);
  if (!search.some((s) => s.itemCode === "110000049")) err("search missed 110000049");
  else ok(`search returned ${search.length} hits`);

  // Missing code
  const missing = await addOfficeReportLine(report.id, "ZZZ-NO-SUCH-CODE");
  if (missing.lookupStatus !== "not_found") err("missing code not flagged");
  else ok("missing code flagged");

  // PDF sample accuracy (never load all 66k into one HTML string in tests)
  detail = (await getOfficeReportDetail(report.id, { page: 1, pageSize: 20 }))!;
  const html = buildOfficeReportPdfHtml(detail);
  const expectedPages = Math.ceil(detail.lines.length / REPORT_ROWS_PER_PAGE) || 1;
  const sheets = (html.match(/class="sheet"/g) || []).length;
  if (sheets !== expectedPages) err(`PDF pages ${sheets} != ${expectedPages}`);
  else ok(`PDF pages=${sheets}`);
  if ((html.match(/PREPARED BY/g) || []).length !== 1) err("approval not once");
  else ok("approval once on final page");
  if (!html.includes("Test Customer LLC")) err("PDF missing customer");
  if (!html.includes("15-Sep-26")) err("PDF missing date");
  // First real item should appear
  if (detail.lines[0]?.itemName && !html.includes(detail.lines[0].itemName)) {
    err("PDF missing first item name");
  }
  // Links clickable
  if (detail.lines[0]?.imageLink && !html.includes(`href="${detail.lines[0].imageLink}"`)) {
    err("PDF missing clickable image link");
  } else ok("PDF contains clickable image links + meta");

  // No placeholder hints
  for (const bad of ["Enter customer", "Type here", "DD-MM-YYYY", "Select...", "Choose shop"]) {
    if (html.includes(bad)) err(`PDF contains hint: ${bad}`);
  }

  writeFileSync("tmp-office-report-preview.html", html, "utf8");

  // Isolation: second import must not share data
  const tiny = await createOfficeReportImport({
    fileName: "second.xlsx",
    fileSize: buffer.length,
    buffer,
    userId: null,
  });
  if (tiny.importRecord.id === importRecord.id) err("imports not versioned");
  const search2 = await searchOfficeItemCodes(tiny.importRecord.id, "110000049", 5);
  if (!search2.length) err("second import search empty");
  else ok("second import isolated + searchable");

  // Delete first report + import
  await deleteOfficeReport(report.id);
  if (await prisma.officeReport.findUnique({ where: { id: report.id } })) {
    err("report not deleted");
  }
  if (await prisma.officeReportImport.findUnique({ where: { id: importRecord.id } })) {
    err("import not deleted with last report");
  } else ok("delete cascades import");

  await deleteOfficeReport(tiny.report.id);
  ok("second report deleted");

  // Inventory source table empty for deleted imports
  const leftover = await prisma.officeReportInventoryItem.count();
  const leftoverImg = await prisma.officeReportImageLink.count();
  if (leftover || leftoverImg) {
    warn(`leftover inventory=${leftover} images=${leftoverImg} (may be from prior runs)`);
    // clean leftovers from failed runs
    await prisma.officeReportImport.deleteMany({});
    ok("cleaned leftover imports");
  }

  console.log("\n=== SUMMARY ===");
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  console.log(`errors=${errors.length} warnings=${warns.length}`);
  if (errors.length) {
    process.exitCode = 1;
    console.log("FAILED");
  } else {
    console.log("PASSED — production accuracy checks OK");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
