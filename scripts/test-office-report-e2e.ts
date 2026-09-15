/**
 * End-to-end: import workbook → lookup → multi-page preview HTML → delete.
 * Run: npx tsx scripts/test-office-report-e2e.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  addOfficeReportLine,
  createOfficeReportImport,
  deleteOfficeReport,
  getOfficeReportDetail,
  updateOfficeReportLine,
  updateOfficeReportMeta,
} from "../src/services/office-report.service";
import { buildOfficeReportPdfHtml, REPORT_ROWS_PER_PAGE } from "../src/lib/report/office-report-pdf-html";
import prisma from "../src/lib/db";

async function main() {
  const path =
    process.argv[2] ||
    "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx";
  const buffer = readFileSync(path);
  console.log("Importing", path, buffer.length, "bytes…");
  const started = Date.now();
  const { report, importRecord } = await createOfficeReportImport({
    fileName: "TFRC_Office_Forms.xlsx",
    fileSize: buffer.length,
    buffer,
    userId: null,
  });
  console.log("Import done in", Date.now() - started, "ms");
  console.log({
    reportId: report.id,
    importId: importRecord.id,
    inventorySheetName: importRecord.inventorySheetName,
    imageSheetName: importRecord.imageSheetName,
    iqsSheetName: importRecord.iqsSheetName,
    inventoryRowCount: importRecord.inventoryRowCount,
    imageLinkCount: importRecord.imageLinkCount,
  });

  await updateOfficeReportMeta(report.id, {
    customerName: "",
    requestedBy: "",
    shopBranch: "",
    notes: "",
    reportDate: "",
  });

  // Sample codes from the workbook I.Q.S sheet
  const codes = [
    "110000049",
    "110000050",
    "110000051",
    "15896000010",
    "15896000027",
    "15896000034",
    "15896000041",
    "15896000058",
    "15896000065",
    "15896000072",
    "15896000089", // 11th → page 2
  ];

  for (const code of codes) {
    const line = await addOfficeReportLine(report.id, code);
    console.log("line", line.itemCode, line.itemName.slice(0, 40), line.onHand, line.lookupStatus);
  }

  // Edit wholesale only — source fields must stay intact
  const detailBefore = await getOfficeReportDetail(report.id);
  const first = detailBefore!.lines[0]!;
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
  const detailAfter = await getOfficeReportDetail(report.id);
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

  const html = buildOfficeReportPdfHtml(detailAfter!);
  const pageCount = Math.ceil(detailAfter!.lines.length / REPORT_ROWS_PER_PAGE);
  const sheetCount = (html.match(/class="sheet"/g) || []).length;
  const approvalCount = (html.match(/PREPARED BY/g) || []).length;
  if (sheetCount !== pageCount) throw new Error(`Expected ${pageCount} sheets, got ${sheetCount}`);
  if (approvalCount !== 1) throw new Error(`Approval should appear once, got ${approvalCount}`);
  if (!html.includes("Page 1 of 2") || !html.includes("Page 2 of 2")) {
    throw new Error("Missing dynamic page numbers");
  }
  if (!html.includes('href="https://pub-c34decbe8eba4a2fa17498e94b1d07b5.r2.dev')) {
    throw new Error("Image links missing from PDF HTML");
  }
  writeFileSync("tmp-office-report-preview.html", html, "utf8");
  console.log("Wrote tmp-office-report-preview.html", "pages", sheetCount);

  // Missing code
  const missing = await addOfficeReportLine(report.id, "DOES-NOT-EXIST-999");
  if (missing.lookupStatus !== "not_found") throw new Error("Expected not_found");
  console.log("Missing code handled:", missing.lookupStatus);

  await deleteOfficeReport(report.id);
  const gone = await prisma.officeReport.findUnique({ where: { id: report.id } });
  const importGone = await prisma.officeReportImport.findUnique({
    where: { id: importRecord.id },
  });
  if (gone || importGone) throw new Error("Delete did not cascade import");
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
