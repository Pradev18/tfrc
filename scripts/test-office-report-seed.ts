import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

loadEnv({ path: resolve(process.cwd(), ".env") });

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const {
    createOfficeReportImport,
    seedOfficeReportLinesBatch,
    getOfficeReportDetail,
    deleteOfficeReport,
  } = await import("../src/services/office-report.service");
  const { parseOfficeFormsWorkbook } = await import("../src/lib/report/office-forms-parser");
  const { default: prisma } = await import("../src/lib/db");
  const buffer = readFileSync(
    "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx"
  );
  const parsed = parseOfficeFormsWorkbook(buffer);
  const uniqueCodes = new Set(parsed.inventoryRows.map((r) => r.itemCode));
  console.log({
    inventoryRows: parsed.inventoryRows.length,
    uniqueCodes: uniqueCodes.size,
    duplicateCodes: parsed.duplicateInventoryCodes.length,
  });

  const { report, needsSeed, uniqueItemCount } = await createOfficeReportImport({
    fileName: "TFRC_Office_Forms.xlsx",
    fileSize: buffer.length,
    buffer,
  });
  console.log({ needsSeed, uniqueItemCount, reportId: report.id });

  let progress = 0;
  while (true) {
    const batch = await seedOfficeReportLinesBatch(report.id);
    progress = batch.progress;
    if (batch.progress % 2500 < 250 || batch.done) {
      console.log(`seed ${batch.progress}/${batch.total}`);
    }
    if (batch.done) break;
  }

  const detail = await getOfficeReportDetail(report.id, { page: 1, pageSize: 5 });
  console.log({
    lineCount: detail?.lineCount,
    firstCodes: detail?.lines.map((l) => l.itemCode),
    seed: detail?.seed,
  });

  if (progress !== uniqueCodes.size) {
    throw new Error(`Expected ${uniqueCodes.size} lines, got ${progress}`);
  }

  await deleteOfficeReport(report.id);
  await prisma.$disconnect();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
