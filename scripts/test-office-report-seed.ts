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
  const { createOfficeReportImport, getOfficeReportDetail, deleteOfficeReport } =
    await import("../src/services/office-report.service");
  const { default: prisma } = await import("../src/lib/db");
  const buffer = readFileSync(
    "C:\\Users\\Prathamesh Devkate\\Downloads\\TFRC_Office_Forms.xlsx"
  );
  const { report } = await createOfficeReportImport({
    fileName: "TFRC_Office_Forms.xlsx",
    fileSize: buffer.length,
    buffer,
  });
  const detail = await getOfficeReportDetail(report.id);
  console.log(
    JSON.stringify(
      {
        lineCount: detail?.lines.length,
        codes: detail?.lines.map((l) => l.itemCode),
        first: detail?.lines[0],
        date: detail?.reportDate,
        customer: detail?.customerName,
      },
      null,
      2
    )
  );
  await deleteOfficeReport(report.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
