/**
 * End-to-end: chunked import → seed → edit → sample PDF HTML → delete.
 * Run: npx tsx scripts/test-office-report-e2e.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  createOfficeReportImport,
  deleteOfficeReport,
  getOfficeReportDetail,
  getOfficeReportDetailForPdf,
  listOfficeReportDuplicateInventory,
  seedOfficeReportLinesBatch,
  updateOfficeReportLine,
  updateOfficeReportMeta,
} from "../src/services/office-report.service";
import { parseOfficeFormsWorkbook } from "../src/lib/report/office-forms-parser";
import { buildOfficeReportPdfHtml, REPORT_ROWS_PER_PAGE } from "../src/lib/report/office-report-pdf-html";
import prisma from "../src/lib/db";

async function main() {
  const path =
    process.argv[2] ||
    "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx";
  const buffer = readFileSync(path);
  const parsed = parseOfficeFormsWorkbook(buffer);
  const uniqueCodes = new Set(parsed.inventoryRows.map((r) => r.itemCode));
  console.log("Importing", path, buffer.length, "bytes…");
  console.log({
    inventoryRows: parsed.inventoryRows.length,
    uniqueCodes: uniqueCodes.size,
    duplicateCodes: parsed.duplicateInventoryCodes.length,
  });

  const started = Date.now();
  const { report, importRecord, needsSeed } = await createOfficeReportImport({
    fileName: "TFRC_Office_Forms.xlsx",
    fileSize: buffer.length,
    buffer,
    userId: null,
  });
  console.log("Parse+store done in", Date.now() - started, "ms", { needsSeed });

  while (true) {
    const batch = await seedOfficeReportLinesBatch(report.id);
    if (batch.done) {
      console.log("Seed complete", batch.progress, "/", batch.total);
      break;
    }
    if (batch.progress % 5000 < 250) {
      console.log("seed", batch.progress, "/", batch.total);
    }
  }

  await updateOfficeReportMeta(report.id, {
    customerName: "E2E Customer",
    requestedBy: "Tester",
    shopBranch: "Rahal",
    notes: "",
    reportDate: "15 Sep 26",
  });

  const page1 = await getOfficeReportDetail(report.id, { page: 1, pageSize: 11 });
  if (!page1 || page1.lineCount !== uniqueCodes.size) {
    throw new Error(`Expected lineCount ${uniqueCodes.size}, got ${page1?.lineCount}`);
  }

  const first = page1.lines[0]!;
  const sourceSnapshot = {
    itemName: first.itemName,
    supplierName: first.supplierName,
    onHand: first.onHand,
    itemCost: first.itemCost,
    sellingPrice: first.sellingPrice,
    imageLink: first.imageLink,
  };
  await updateOfficeReportLine(report.id, first.id, {
    wholesalePriceApproval: "1500",
  });
  const detailAfter = await getOfficeReportDetail(report.id, { page: 1, pageSize: 11 });
  const firstAfter = detailAfter!.lines[0]!;
  if (
    firstAfter.itemName !== sourceSnapshot.itemName ||
    firstAfter.supplierName !== sourceSnapshot.supplierName ||
    firstAfter.onHand !== sourceSnapshot.onHand ||
    firstAfter.itemCost !== sourceSnapshot.itemCost ||
    firstAfter.sellingPrice !== sourceSnapshot.sellingPrice ||
    firstAfter.imageLink !== sourceSnapshot.imageLink
  ) {
    throw new Error("Source-derived fields were mutated when editing wholesale approval");
  }
  if (firstAfter.wholesalePriceApproval !== "1500") {
    throw new Error("Wholesale approval did not save");
  }
  console.log("CRUD edit OK — source fields immutable");

  const duplicates = await listOfficeReportDuplicateInventory(importRecord.id);
  if (!duplicates) throw new Error("Duplicates endpoint returned null");
  console.log("Duplicates listed:", duplicates.duplicateItemCodes.length);

  const sample = await getOfficeReportDetailForPdf(report.id, { maxLines: 20 });
  const html = buildOfficeReportPdfHtml(sample!, {
    sampleNote: sample?.truncated ? "sample" : undefined,
  });
  const pageCount = Math.ceil(sample!.lines.length / REPORT_ROWS_PER_PAGE);
  const sheetCount = (html.match(/class="sheet"/g) || []).length;
  if (sheetCount !== pageCount) throw new Error(`Expected ${pageCount} sheets, got ${sheetCount}`);
  writeFileSync("tmp-office-report-preview.html", html, "utf8");
  console.log("Wrote sample preview", "pages", sheetCount, "truncated", sample?.truncated);

  await deleteOfficeReport(report.id);
  console.log("Delete OK");
  console.log("ALL E2E CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
