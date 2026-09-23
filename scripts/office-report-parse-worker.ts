/**
 * Worker entry: decode + normalize a report workbook OFF the Next.js event loop,
 * then write chunked JSONL to disk so the main process never freezes on a 70k clone.
 */
import { parentPort, workerData } from "node:worker_threads";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseOfficeFormsWorkbook } from "../src/lib/report/office-forms-parser";

const ROWS_PER_CHUNK = 400;

function send(message: Record<string, unknown>) {
  parentPort?.postMessage(message);
}

function writeJsonlChunksSync(
  dir: string,
  prefix: string,
  rows: unknown[]
): number {
  if (rows.length === 0) return 0;
  let chunks = 0;
  for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
    const slice = rows.slice(start, start + ROWS_PER_CHUNK);
    const file = path.join(dir, `${prefix}.${chunks}.jsonl`);
    const body =
      slice.map((row) => JSON.stringify(row)).join("\n") + (slice.length ? "\n" : "");
    writeFileSync(file, body, "utf8");
    chunks += 1;
  }
  return chunks;
}

try {
  const data = workerData as {
    buffer: ArrayBuffer | Buffer;
    fileName?: string;
    importId: string;
    outDir: string;
  };
  const buffer = Buffer.isBuffer(data.buffer)
    ? data.buffer
    : Buffer.from(data.buffer);
  const fileName = data.fileName || "workbook.xlsx";
  const importId = String(data.importId || "").trim();
  const outDir = String(data.outDir || "").trim();
  if (!importId || !outDir) {
    throw new Error("Worker missing importId/outDir.");
  }

  mkdirSync(outDir, { recursive: true });

  const parsed = parseOfficeFormsWorkbook(buffer, fileName);
  const uniqueItemCount = new Set(parsed.inventoryRows.map((row) => row.itemCode)).size;

  const inventoryChunks = writeJsonlChunksSync(
    outDir,
    `${importId}.inv`,
    parsed.inventoryRows
  );
  const imageChunks = writeJsonlChunksSync(
    outDir,
    `${importId}.img`,
    parsed.imageLinks
  );

  const meta = {
    inventorySheetName: parsed.inventorySheetName,
    imageSheetName: parsed.imageSheetName,
    iqsSheetName: parsed.iqsSheetName,
    inventoryHeaders: parsed.inventoryHeaders,
    columnMap: parsed.columnMap,
    duplicateInventoryCodes: parsed.duplicateInventoryCodes,
    iqsFormMeta: parsed.iqsFormMeta,
    iqsSeedRows: parsed.iqsSeedRows,
    inventoryRowCount: parsed.inventoryRows.length,
    imageLinkCount: parsed.imageLinks.length,
    uniqueItemCount,
    inventoryChunks,
    imageChunks,
    rowsPerChunk: ROWS_PER_CHUNK,
  };
  writeFileSync(
    path.join(outDir, `${importId}.parsed-meta.json`),
    JSON.stringify(meta),
    "utf8"
  );

  // Drop huge arrays before messaging — only small meta crosses to the main thread.
  send({
    ok: true,
    inventoryRowCount: meta.inventoryRowCount,
    imageLinkCount: meta.imageLinkCount,
    uniqueItemCount,
    inventoryChunks,
    imageChunks,
    rowsPerChunk: ROWS_PER_CHUNK,
  });
} catch (error) {
  send({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
