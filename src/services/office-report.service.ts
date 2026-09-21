import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  lookupOfficeFormsFields,
  parseOfficeFormsWorkbook,
  type OfficeFormsColumnMap,
  type ParsedImageLink,
  type ParsedInventoryRow,
  type ParsedOfficeFormsWorkbook,
} from "@/lib/report/office-forms-parser";
import { normalizeItemCode } from "@/lib/report/office-forms-normalize";
import {
  itemCodeMatchVariants,
  pickPreferredImageUrl,
} from "@/lib/report/report-image-src";
import {
  deleteReportImportWorkbook,
  readReportImportWorkbook,
  saveReportImportWorkbook,
} from "@/lib/report/office-report-upload-store";
import { explainExcelParseFailure } from "@/lib/report/excel-file-guard";

/**
 * Balanced for Hostinger single-process:
 * - Enough rows per HTTP call to finish 70k without endless round-trips
 * - Sub-batches + event-loop yields so storefront can still answer
 */
const INGEST_SUB_BATCH = 280;
const INGEST_ROWS_PER_REQUEST = 1120;
/** @deprecated kept for old seed route callers */
const SEED_BATCH = 250;

type CachedParse = {
  parsed: ParsedOfficeFormsWorkbook;
  uniqueItemCount: number;
};

const parseCache = new Map<string, CachedParse>();

function sourceTotal(inventoryRowCount: number, imageLinkCount: number): number {
  return Math.max(0, inventoryRowCount) + Math.max(0, imageLinkCount);
}

/** Let storefront / other requests run between heavy SQLite bursts. */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function getCachedParse(importId: string, fileName = "workbook.xlsx"): Promise<CachedParse> {
  const hit = parseCache.get(importId);
  if (hit) return hit;
  const buffer = await readReportImportWorkbook(importId);
  if (!buffer) {
    throw new Error(
      "Upload session expired or the server restarted before import finished. Upload the Excel file again."
    );
  }
  await yieldEventLoop();
  let parsed: ParsedOfficeFormsWorkbook;
  try {
    parsed = parseOfficeFormsWorkbook(buffer, fileName);
  } catch (error) {
    throw explainExcelParseFailure(error, fileName);
  }
  await yieldEventLoop();
  const uniqueItemCount = new Set(parsed.inventoryRows.map((row) => row.itemCode)).size;
  const entry = { parsed, uniqueItemCount };
  parseCache.set(importId, entry);
  return entry;
}

function clearCachedParse(importId: string) {
  parseCache.delete(importId);
}

/**
 * Fast path: save workbook only. Full XLSX parse runs on first ingest so upload
 * complete does not freeze the Node process (storefront / admin) for 70k+ rows.
 */
export async function createOfficeReportImport(input: {
  fileName: string;
  fileSize: number;
  buffer: Buffer;
  userId?: string | null;
}) {
  const created = await prisma.officeReportImport.create({
    data: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      status: "PENDING",
      inventorySheetName: null,
      imageSheetName: null,
      iqsSheetName: null,
      inventoryHeaders: "[]",
      columnMap: "{}",
      inventoryRowCount: 0,
      imageLinkCount: 0,
      duplicateItemCodes: "[]",
      uniqueItemCount: 0,
      seedProgress: 0,
      iqsWholesaleByCode: "{}",
      createdByUserId: input.userId ?? null,
    },
  });

  try {
    await saveReportImportWorkbook(created.id, input.buffer);

    const report = await prisma.officeReport.create({
      data: {
        importId: created.id,
        createdByUserId: input.userId ?? null,
        tfrcLabel: "TFRC",
      },
    });

    const importRecord = await prisma.officeReportImport.findUniqueOrThrow({
      where: { id: created.id },
    });

    return {
      importRecord,
      report,
      seededLineCount: 0,
      uniqueItemCount: 0,
      needsSeed: false,
      needsIngest: true,
    };
  } catch (error) {
    clearCachedParse(created.id);
    await deleteReportImportWorkbook(created.id).catch(() => null);
    await prisma.officeReportImport.delete({ where: { id: created.id } }).catch(() => null);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save imported workbook data"
    );
  }
}

async function syncImportMetaFromParse(
  importId: string,
  parsed: ParsedOfficeFormsWorkbook,
  uniqueItemCount: number
) {
  const wholesaleByCode: Record<string, string> = {};
  for (const seed of parsed.iqsSeedRows) {
    wholesaleByCode[seed.itemCode] = seed.wholesalePriceApproval;
  }

  await prisma.officeReportImport.update({
    where: { id: importId },
    data: {
      inventorySheetName: parsed.inventorySheetName,
      imageSheetName: parsed.imageSheetName,
      iqsSheetName: parsed.iqsSheetName,
      inventoryHeaders: JSON.stringify(parsed.inventoryHeaders),
      columnMap: JSON.stringify(parsed.columnMap),
      inventoryRowCount: parsed.inventoryRows.length,
      imageLinkCount: parsed.imageLinks.length,
      duplicateItemCodes: JSON.stringify(parsed.duplicateInventoryCodes),
      uniqueItemCount,
      iqsWholesaleByCode: JSON.stringify(wholesaleByCode),
      errorMessage: null,
    },
  });

  await prisma.officeReport.updateMany({
    where: { importId },
    data: {
      tfrcLabel: parsed.iqsFormMeta.tfrcLabel || "TFRC",
      customerName: parsed.iqsFormMeta.customerName,
      requestedBy: parsed.iqsFormMeta.requestedBy,
      shopBranch: parsed.iqsFormMeta.shopBranch,
      notes: parsed.iqsFormMeta.notes,
      reportDate: formatIqsReportDate(parsed.iqsFormMeta.reportDate),
    },
  });
}

/**
 * Write the next chunk of inventory / image source rows for lookup.
 * One HTTP call writes several sub-batches (with yields) so 70k imports finish
 * without locking the shop the whole time — and without endless tiny round-trips.
 */
export async function ingestOfficeReportSourceBatch(
  importId: string,
  _batchSize = INGEST_ROWS_PER_REQUEST
) {
  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
  });
  if (!importRecord) throw new Error("Import not found.");
  if (importRecord.status === "FAILED") {
    throw new Error(importRecord.errorMessage || "Import failed.");
  }
  if (importRecord.status === "READY") {
    return {
      done: true,
      progress: importRecord.seedProgress,
      total: sourceTotal(importRecord.inventoryRowCount, importRecord.imageLinkCount),
      phase: "done" as const,
    };
  }

  try {
    const { parsed, uniqueItemCount } = await getCachedParse(importId, importRecord.fileName);

    const needsMeta =
      !importRecord.inventorySheetName ||
      importRecord.inventoryRowCount !== parsed.inventoryRows.length ||
      importRecord.imageLinkCount !== parsed.imageLinks.length;

    if (needsMeta) {
      await syncImportMetaFromParse(importId, parsed, uniqueItemCount);
      await yieldEventLoop();
    }

    const inventoryTotal = parsed.inventoryRows.length;
    const imageTotal = parsed.imageLinks.length;
    const total = inventoryTotal + imageTotal;

    if (total <= 0) {
      await prisma.officeReportImport.update({
        where: { id: importId },
        data: { status: "READY", seedProgress: 0, errorMessage: null },
      });
      clearCachedParse(importId);
      await deleteReportImportWorkbook(importId).catch(() => null);
      return { done: true, progress: 0, total: 0, phase: "done" as const };
    }

    // Always resume from DB counts so a crashed mid-request cannot duplicate rows.
    const [savedInventory, savedImages] = await Promise.all([
      prisma.officeReportInventoryItem.count({ where: { importId } }),
      prisma.officeReportImageLink.count({ where: { importId } }),
    ]);
    let progress =
      savedInventory < inventoryTotal
        ? savedInventory
        : inventoryTotal + Math.min(savedImages, imageTotal);

    const requestEnd = Math.min(progress + INGEST_ROWS_PER_REQUEST, total);
    let phase: "inventory" | "images" | "done" =
      progress < inventoryTotal ? "inventory" : "images";

    while (progress < requestEnd) {
      const take = Math.min(INGEST_SUB_BATCH, requestEnd - progress);

      if (progress < inventoryTotal) {
        const start = progress;
        const chunk = parsed.inventoryRows.slice(
          start,
          Math.min(start + take, inventoryTotal)
        );
        if (chunk.length > 0) {
          await prisma.officeReportInventoryItem.createMany({
            data: chunk.map((row, offset) => ({
              importId,
              itemCode: row.itemCode,
              payload: JSON.stringify(row.payload),
              sortOrder: start + offset,
            })),
          });
          progress = start + chunk.length;
          phase = "inventory";
        } else {
          progress = inventoryTotal;
        }
      } else {
        const imageStart = progress - inventoryTotal;
        const chunk = parsed.imageLinks.slice(
          imageStart,
          Math.min(imageStart + take, imageTotal)
        );
        if (chunk.length > 0) {
          await prisma.officeReportImageLink.createMany({
            data: chunk.map((row, offset) => ({
              importId,
              itemCode: row.itemCode,
              imageUrl: row.imageUrl,
              fileName: row.fileName ?? null,
              sortOrder: imageStart + offset,
            })),
          });
          progress = inventoryTotal + imageStart + chunk.length;
          phase = "images";
        } else {
          progress = total;
        }
      }

      // Let storefront / admin requests run between SQLite write bursts.
      await yieldEventLoop();
      await new Promise((r) => setTimeout(r, 8));
    }

    const done = progress >= total;
    await prisma.officeReportImport.update({
      where: { id: importId },
      data: {
        seedProgress: progress,
        status: done ? "READY" : "PENDING",
        errorMessage: null,
        inventoryRowCount: inventoryTotal,
        imageLinkCount: imageTotal,
        uniqueItemCount,
      },
    });

    if (done) {
      clearCachedParse(importId);
      await deleteReportImportWorkbook(importId).catch(() => null);
      phase = "done";
    }

    return {
      done,
      progress,
      total,
      phase,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to finish workbook import";
    const fatal =
      message.startsWith("Excel problem") ||
      message.toLowerCase().includes("password") ||
      message.toLowerCase().includes("encrypted") ||
      message.toLowerCase().includes("not a valid excel") ||
      message.toLowerCase().includes("upload session expired");
    if (fatal) {
      await prisma.officeReportImport
        .update({
          where: { id: importId },
          data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
        })
        .catch(() => null);
      clearCachedParse(importId);
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

/**
 * Does not insert report lines. If source ingest is still PENDING, finish that instead.
 */
export async function seedOfficeReportLinesBatch(reportId: string, _batchSize = SEED_BATCH) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: { import: true },
  });
  if (!report) throw new Error("Report not found.");
  if (report.import.status === "FAILED") {
    throw new Error(report.import.errorMessage || "Import failed.");
  }
  if (report.import.status === "PENDING") {
    const batch = await ingestOfficeReportSourceBatch(report.importId);
    return {
      done: batch.done,
      seeded: 0,
      total: batch.total,
      progress: batch.progress,
    };
  }
  return {
    done: true,
    seeded: 0,
    total: report.import.uniqueItemCount,
    progress: report.import.uniqueItemCount,
  };
}

export async function getOfficeReportSeedStatus(reportId: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: { import: true },
  });
  if (!report) return null;
  return {
    reportId: report.id,
    importId: report.import.id,
    status: report.import.status,
    progress: report.import.seedProgress,
    total: report.import.uniqueItemCount,
    done: report.import.status === "READY",
    errorMessage: report.import.errorMessage,
  };
}

function formatIqsReportDate(raw: string): string {
  if (!raw) return "";
  // Excel serial date sometimes arrives as a number string (e.g. 46279).
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(asNumber));
    return epoch.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }
  return raw;
}

export async function listOfficeReports() {
  const reports = await prisma.officeReport.findMany({
    where: { import: { status: { in: ["READY", "PENDING", "FAILED"] } } },
    orderBy: { createdAt: "desc" },
    include: {
      import: true,
      _count: { select: { lines: true } },
    },
  });
  return reports.map((report) => ({
    id: report.id,
    title: report.title,
    customerName: report.customerName,
    reportDate: report.reportDate,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    lineCount: report._count.lines,
    import: {
      id: report.import.id,
      fileName: report.import.fileName,
      status: report.import.status,
      inventoryRowCount: report.import.inventoryRowCount,
      imageLinkCount: report.import.imageLinkCount,
      uniqueItemCount: report.import.uniqueItemCount,
      seedProgress: report.import.seedProgress,
      inventorySheetName: report.import.inventorySheetName,
      imageSheetName: report.import.imageSheetName,
      iqsSheetName: report.import.iqsSheetName,
      errorMessage: report.import.errorMessage,
      createdAt: report.import.createdAt.toISOString(),
    },
  }));
}

const DEFAULT_PAGE_SIZE = 100;

type OfficeReportLineRow = {
  id: string;
  sortOrder: number;
  itemCode: string;
  imageLink: string;
  itemName: string;
  supplierName: string;
  onHand: string;
  itemCost: string;
  sellingPrice: string;
  wholesalePriceApproval: string;
  lookupStatus: string;
  lookupWarning: string | null;
};

/** Keep first occurrence of each item code (original) for PDF / template. */
export function dedupeReportLinesKeepOriginal<T extends { itemCode: string }>(
  lines: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const line of lines) {
    if (seen.has(line.itemCode)) continue;
    seen.add(line.itemCode);
    out.push(line);
  }
  return out;
}

export async function getOfficeReportDetail(
  reportId: string,
  opts?: { page?: number; pageSize?: number }
) {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? DEFAULT_PAGE_SIZE, 1), 500);
  const page = Math.max(opts?.page ?? 1, 1);
  const skip = (page - 1) * pageSize;

  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        skip,
        take: pageSize,
      },
      _count: { select: { lines: true } },
    },
  });
  if (!report) return null;
  if (report.import.status === "FAILED") return null;

  const lineCount = report._count.lines;
  const serialized = serializeReport(report);
  const lines =
    report.import.status === "READY"
      ? await enrichLinesWithPreferredImages(report.importId, serialized.lines)
      : serialized.lines;
  const sourceTotalRows = sourceTotal(
    report.import.inventoryRowCount,
    report.import.imageLinkCount
  );
  return {
    ...serialized,
    lines,
    lineCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(Math.max(lineCount, 1) / pageSize)),
    seed: {
      status: report.import.status,
      progress: report.import.seedProgress,
      total: sourceTotalRows,
      done: report.import.status === "READY",
    },
  };
}

/** Meta + line count only — never load all 66k lines into memory. */
export async function getOfficeReportPrintMeta(reportId: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: true,
      _count: { select: { lines: true } },
    },
  });
  if (!report) return null;
  if (report.import.status !== "READY") return null;
  return {
    id: report.id,
    title: report.title,
    customerName: report.customerName,
    requestedBy: report.requestedBy,
    shopBranch: report.shopBranch,
    tfrcLabel: report.tfrcLabel,
    notes: report.notes,
    reportDate: report.reportDate,
    lineCount: report._count.lines,
    import: {
      id: report.import.id,
      fileName: report.import.fileName,
      duplicateItemCodes: safeJsonArray(report.import.duplicateItemCodes),
      inventoryRowCount: report.import.inventoryRowCount,
      uniqueItemCount: report.import.uniqueItemCount,
    },
  };
}

/** @deprecated Prefer paginated print page — kept for small sample previews only. */
export async function getOfficeReportDetailForPdf(
  reportId: string,
  opts?: { maxLines?: number }
) {
  const maxLines = Math.min(Math.max(opts?.maxLines ?? 50, 1), 200);
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: true,
      lines: { orderBy: { sortOrder: "asc" }, take: maxLines },
      _count: { select: { lines: true } },
    },
  });
  if (!report) return null;
  if (report.import.status !== "READY") return null;

  const uniqueLines = dedupeReportLinesKeepOriginal(report.lines);
  const serialized = serializeReport({ ...report, lines: uniqueLines });
  const lines = await enrichLinesWithPreferredImages(
    report.importId,
    serialized.lines
  );
  return {
    ...serialized,
    lines,
    lineCount: report._count.lines,
    page: 1,
    pageSize: uniqueLines.length,
    pageCount: 1,
    truncated: report._count.lines > uniqueLines.length,
  };
}

export async function listOfficeReportDuplicateInventory(importId: string) {
  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
    select: { status: true, duplicateItemCodes: true, columnMap: true },
  });
  if (!importRecord || importRecord.status !== "READY") return null;

  const duplicateCodes = safeJsonArray(importRecord.duplicateItemCodes);
  if (duplicateCodes.length === 0) {
    return { duplicateItemCodes: [] as string[], groups: [] as Array<{
      itemCode: string;
      occurrences: Array<{
        sortOrder: number;
        isOriginal: boolean;
        itemName: string;
        supplierName: string;
        onHand: string;
        itemCost: string;
        sellingPrice: string;
      }>;
    }> };
  }

  const columnMap = safeJsonObject(importRecord.columnMap) as unknown as OfficeFormsColumnMap;
  const rows = await prisma.officeReportInventoryItem.findMany({
    where: { importId, itemCode: { in: duplicateCodes } },
    orderBy: [{ itemCode: "asc" }, { sortOrder: "asc" }],
  });

  const byCode = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCode.get(row.itemCode) ?? [];
    list.push(row);
    byCode.set(row.itemCode, list);
  }

  const groups = duplicateCodes.map((itemCode) => {
    const matches = byCode.get(itemCode) ?? [];
    return {
      itemCode,
      occurrences: matches.map((row, index) => {
        const payload = safeJsonObject(row.payload) as Record<string, string>;
        return {
          sortOrder: row.sortOrder,
          isOriginal: index === 0,
          itemName: columnMap.description ? payload[columnMap.description] || "" : "",
          supplierName: columnMap.supplierName ? payload[columnMap.supplierName] || "" : "",
          onHand: columnMap.onHand ? payload[columnMap.onHand] || "" : "",
          itemCost: columnMap.itemCost ? payload[columnMap.itemCost] || "" : "",
          sellingPrice: columnMap.retailPrice ? payload[columnMap.retailPrice] || "" : "",
        };
      }),
    };
  });

  return { duplicateItemCodes: duplicateCodes, groups };
}

function serializeReport(report: {
  id: string;
  title: string;
  customerName: string;
  requestedBy: string;
  shopBranch: string;
  tfrcLabel: string;
  notes: string;
  reportDate: string;
  createdAt: Date;
  updatedAt: Date;
  import: {
    id: string;
    fileName: string;
    status: string;
    inventorySheetName: string | null;
    imageSheetName: string | null;
    iqsSheetName: string | null;
    inventoryRowCount: number;
    imageLinkCount: number;
    uniqueItemCount: number;
    seedProgress: number;
    duplicateItemCodes: string;
    columnMap: string;
  };
  lines: OfficeReportLineRow[];
}) {
  return {
    id: report.id,
    title: report.title,
    customerName: report.customerName,
    requestedBy: report.requestedBy,
    shopBranch: report.shopBranch,
    tfrcLabel: report.tfrcLabel,
    notes: report.notes,
    reportDate: report.reportDate,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    import: {
      id: report.import.id,
      fileName: report.import.fileName,
      status: report.import.status,
      inventorySheetName: report.import.inventorySheetName,
      imageSheetName: report.import.imageSheetName,
      iqsSheetName: report.import.iqsSheetName,
      inventoryRowCount: report.import.inventoryRowCount,
      imageLinkCount: report.import.imageLinkCount,
      uniqueItemCount: report.import.uniqueItemCount,
      seedProgress: report.import.seedProgress,
      duplicateItemCodes: safeJsonArray(report.import.duplicateItemCodes),
      columnMap: safeJsonObject(report.import.columnMap) as unknown as OfficeFormsColumnMap,
    },
    lines: report.lines.map((line) => ({
      id: line.id,
      sortOrder: line.sortOrder,
      itemCode: line.itemCode,
      imageLink: line.imageLink,
      itemName: line.itemName,
      supplierName: line.supplierName,
      onHand: line.onHand,
      itemCost: line.itemCost,
      sellingPrice: line.sellingPrice,
      wholesalePriceApproval: line.wholesalePriceApproval,
      lookupStatus: line.lookupStatus,
      lookupWarning: line.lookupWarning,
    })),
  };
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Existing seeded lines may store the first Cloud Fare URL (.emf).
 * Re-pick a browser-displayable raster from all import image rows at read time.
 */
async function enrichLinesWithPreferredImages<
  T extends { itemCode: string; imageLink: string },
>(importId: string, lines: T[]): Promise<T[]> {
  if (lines.length === 0) return lines;
  const variants = [
    ...new Set(lines.flatMap((line) => itemCodeMatchVariants(line.itemCode))),
  ];
  const imageRows = await prisma.officeReportImageLink.findMany({
    where: { importId, itemCode: { in: variants } },
    orderBy: [{ itemCode: "asc" }, { sortOrder: "asc" }],
    select: { itemCode: true, imageUrl: true },
  });

  const urlsByVariant = new Map<string, string[]>();
  for (const row of imageRows) {
    for (const key of itemCodeMatchVariants(row.itemCode)) {
      const list = urlsByVariant.get(key) ?? [];
      list.push(row.imageUrl);
      urlsByVariant.set(key, list);
    }
  }

  return lines.map((line) => {
    const candidates = [
      ...(urlsByVariant.get(line.itemCode) ?? []),
      ...itemCodeMatchVariants(line.itemCode).flatMap(
        (v) => urlsByVariant.get(v) ?? []
      ),
      line.imageLink,
    ].filter(Boolean);
    const preferred = pickPreferredImageUrl([...new Set(candidates)]);
    if (!preferred) return line;
    if (preferred === line.imageLink) return line;
    return { ...line, imageLink: preferred };
  });
}

function safeJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function findInventoryRows(importId: string, itemCode: string) {
  const variants = itemCodeMatchVariants(itemCode);
  const exact = await prisma.officeReportInventoryItem.findMany({
    where: { importId, itemCode: { in: variants } },
    orderBy: { sortOrder: "asc" },
    take: 20,
  });
  if (exact.length > 0) return exact;

  // Prefix search uses the itemCode index so this stays fast on 60k+ inventory rows.
  const prefixes = [...new Set(variants.filter((code) => code.length >= 2))].slice(0, 8);
  if (prefixes.length === 0) return exact;
  const candidates = await prisma.officeReportInventoryItem.findMany({
    where: {
      importId,
      OR: prefixes.map((prefix) => ({ itemCode: { startsWith: prefix } })),
    },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
  const wanted = new Set(variants.map((code) => code.toLowerCase()));
  return candidates.filter((row) => {
    const normalized = normalizeItemCode(row.itemCode).toLowerCase();
    if (wanted.has(normalized)) return true;
    return itemCodeMatchVariants(row.itemCode).some((code) => wanted.has(code.toLowerCase()));
  });
}

async function findImageRows(importId: string, itemCode: string) {
  const variants = itemCodeMatchVariants(itemCode);
  const exact = await prisma.officeReportImageLink.findMany({
    where: { importId, itemCode: { in: variants } },
    orderBy: { sortOrder: "asc" },
    take: 50,
  });
  if (exact.length > 0) return exact;

  const prefixes = [...new Set(variants.filter((code) => code.length >= 2))].slice(0, 8);
  if (prefixes.length === 0) return exact;
  const candidates = await prisma.officeReportImageLink.findMany({
    where: {
      importId,
      OR: prefixes.map((prefix) => ({ itemCode: { startsWith: prefix } })),
    },
    orderBy: { sortOrder: "asc" },
    take: 80,
  });
  const wanted = new Set(variants.map((code) => code.toLowerCase()));
  const filtered = candidates.filter((row) => {
    const normalized = normalizeItemCode(row.itemCode).toLowerCase();
    if (wanted.has(normalized)) return true;
    return itemCodeMatchVariants(row.itemCode).some((code) => wanted.has(code.toLowerCase()));
  });
  if (filtered.length > 0) return filtered;

  // Last resort for numeric codes: match by shared digit core (leading-zero drift).
  const stripped = itemCode.replace(/^0+/, "");
  if (!/^\d{6,}$/.test(stripped)) return filtered;
  const loose = await prisma.officeReportImageLink.findMany({
    where: {
      importId,
      OR: [
        { itemCode: stripped },
        { itemCode: { endsWith: stripped } },
        { itemCode: { contains: stripped } },
      ],
    },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
  return loose.filter((row) =>
    itemCodeMatchVariants(row.itemCode).some((code) => wanted.has(code.toLowerCase()))
  );
}

function wholesaleForCode(
  wholesaleByCode: Record<string, string>,
  itemCode: string
): string {
  const direct = wholesaleByCode[itemCode];
  if (direct) return direct;
  for (const variant of itemCodeMatchVariants(itemCode)) {
    const value = wholesaleByCode[variant];
    if (value) return value;
  }
  return "";
}

async function resolveLookup(importId: string, itemCodeRaw: string) {
  const itemCode = normalizeItemCode(itemCodeRaw);
  if (!itemCode) {
    throw new Error("Item code is required.");
  }

  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
  });
  if (!importRecord || importRecord.status !== "READY") {
    throw new Error("Report import is not ready.");
  }

  const columnMap = safeJsonObject(importRecord.columnMap) as unknown as OfficeFormsColumnMap;
  const [inventoryMatches, imageMatches] = await Promise.all([
    findInventoryRows(importId, itemCode),
    findImageRows(importId, itemCode),
  ]);

  const parsedInventory: ParsedInventoryRow[] = inventoryMatches.map((row) => ({
    itemCode: row.itemCode,
    payload: safeJsonObject(row.payload) as Record<string, string>,
  }));
  const parsedImages: ParsedImageLink[] = imageMatches.map((row) => ({
    itemCode: row.itemCode,
    imageUrl: row.imageUrl,
    fileName: row.fileName ?? undefined,
  }));

  const lookedUp = lookupOfficeFormsFields(
    { columnMap },
    parsedInventory,
    parsedImages
  );
  if (lookedUp.lookupStatus === "not_found") {
    throw new Error(
      `Item code ${itemCode} was not found in the uploaded Item_Qty_in_Store data.`
    );
  }

  // Compulsory: if Cloud Fare has any link for this code, the report line must carry it.
  const preferredImage =
    lookedUp.imageLink ||
    pickPreferredImageUrl(parsedImages.map((row) => row.imageUrl).filter(Boolean));
  const fields = {
    ...lookedUp,
    imageLink: preferredImage || lookedUp.imageLink,
    lookupWarning:
      !preferredImage && importRecord.imageLinkCount > 0 && parsedImages.length === 0
        ? [lookedUp.lookupWarning, "No Cloud Fare / Cloudflare image link matched this item code."]
            .filter(Boolean)
            .join(" ")
        : lookedUp.lookupWarning,
  };

  const wholesaleByCode = safeJsonObject(importRecord.iqsWholesaleByCode) as Record<
    string,
    string
  >;
  const canonicalCode = inventoryMatches[0]?.itemCode || itemCode;

  return {
    itemCode: canonicalCode,
    fields,
    wholesalePriceApproval: wholesaleForCode(wholesaleByCode, canonicalCode),
  };
}

export async function addOfficeReportLine(reportId: string, itemCodeRaw: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: { select: { status: true } },
    },
  });
  if (!report) throw new Error("Report not found.");
  if (report.import.status !== "READY") {
    throw new Error(
      "Excel is still being prepared for lookup. Wait until the progress finishes, then add codes."
    );
  }

  const { itemCode, fields, wholesalePriceApproval } = await resolveLookup(
    report.importId,
    itemCodeRaw
  );

  const codeKeys = [...new Set(itemCodeMatchVariants(itemCode))];
  const existingLine = await prisma.officeReportLine.findFirst({
    where: { reportId, itemCode: { in: codeKeys.length > 0 ? codeKeys : [itemCode] } },
    select: { id: true },
  });
  if (existingLine) {
    return {
      id: existingLine.id,
      itemCode,
      alreadyExists: true as const,
      lookupStatus: "ok" as string,
    };
  }

  const agg = await prisma.officeReportLine.aggregate({
    where: { reportId },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? 0) + 1;

  const created = await prisma.officeReportLine.create({
    data: {
      reportId,
      sortOrder: nextOrder,
      itemCode,
      imageLink: fields.imageLink,
      itemName: fields.itemName,
      supplierName: fields.supplierName,
      onHand: fields.onHand,
      itemCost: fields.itemCost,
      sellingPrice: fields.sellingPrice,
      wholesalePriceApproval,
      lookupStatus: fields.lookupStatus,
      lookupWarning: fields.lookupWarning,
    },
  });

  return {
    id: created.id,
    itemCode,
    alreadyExists: false as const,
    lookupStatus: created.lookupStatus,
  };
}

export async function clearOfficeReportLines(reportId: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    select: { id: true },
  });
  if (!report) throw new Error("Report not found.");
  const result = await prisma.officeReportLine.deleteMany({ where: { reportId } });
  return { deleted: result.count };
}

export async function updateOfficeReportMeta(
  reportId: string,
  patch: Partial<{
    customerName: string;
    requestedBy: string;
    shopBranch: string;
    tfrcLabel: string;
    notes: string;
    reportDate: string;
    title: string;
  }>
) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: { import: { select: { status: true } } },
  });
  if (!report) throw new Error("Report not found.");
  if (report.import.status !== "READY") {
    throw new Error("Report import is not ready.");
  }

  return prisma.officeReport.update({
    where: { id: reportId },
    data: {
      ...(patch.customerName != null ? { customerName: String(patch.customerName) } : {}),
      ...(patch.requestedBy != null ? { requestedBy: String(patch.requestedBy) } : {}),
      ...(patch.shopBranch != null ? { shopBranch: String(patch.shopBranch) } : {}),
      ...(patch.tfrcLabel != null ? { tfrcLabel: String(patch.tfrcLabel) } : {}),
      ...(patch.notes != null ? { notes: String(patch.notes) } : {}),
      ...(patch.reportDate != null ? { reportDate: String(patch.reportDate) } : {}),
      ...(patch.title != null ? { title: String(patch.title) } : {}),
    },
  });
}

export async function updateOfficeReportLine(
  reportId: string,
  lineId: string,
  patch: Partial<{
    itemCode: string;
    wholesalePriceApproval: string;
  }>
) {
  const existing = await prisma.officeReportLine.findFirst({
    where: { id: lineId, reportId },
    include: { report: { include: { import: { select: { status: true, id: true } } } } },
  });
  if (!existing) throw new Error("Report line not found.");
  if (existing.report.import.status !== "READY") {
    throw new Error("Report import is not ready.");
  }

  // Source-derived fields stay immutable unless item code itself changes (re-lookup).
  if (patch.itemCode != null && normalizeItemCode(patch.itemCode) !== existing.itemCode) {
    const { itemCode, fields, wholesalePriceApproval } = await resolveLookup(
      existing.report.import.id,
      patch.itemCode
    );
    return prisma.officeReportLine.update({
      where: { id: lineId },
      data: {
        itemCode,
        imageLink: fields.imageLink,
        itemName: fields.itemName,
        supplierName: fields.supplierName,
        onHand: fields.onHand,
        itemCost: fields.itemCost,
        sellingPrice: fields.sellingPrice,
        wholesalePriceApproval:
          patch.wholesalePriceApproval != null
            ? String(patch.wholesalePriceApproval)
            : wholesalePriceApproval,
        lookupStatus: fields.lookupStatus,
        lookupWarning: fields.lookupWarning,
      },
    });
  }

  return prisma.officeReportLine.update({
    where: { id: lineId },
    data: {
      ...(patch.wholesalePriceApproval != null
        ? { wholesalePriceApproval: String(patch.wholesalePriceApproval) }
        : {}),
    },
  });
}

export async function deleteOfficeReportLine(reportId: string, lineId: string) {
  const existing = await prisma.officeReportLine.findFirst({
    where: { id: lineId, reportId },
  });
  if (!existing) throw new Error("Report line not found.");
  await prisma.officeReportLine.delete({ where: { id: lineId } });
}

export async function deleteOfficeReport(reportId: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: { include: { _count: { select: { reports: true } } } },
    },
  });
  if (!report) throw new Error("Report not found.");

  const importId = report.importId;
  const siblingCount = report.import._count.reports;

  await prisma.$transaction(async (tx) => {
    await tx.officeReport.delete({ where: { id: reportId } });
    // If this was the only report for the import, remove the import + source data too.
    if (siblingCount <= 1) {
      await tx.officeReportImport.delete({ where: { id: importId } });
    }
  });
}

function currentUploadCodeFilter(query: string): Prisma.Sql {
  const q = normalizeItemCode(query);
  if (!q) return Prisma.empty;
  const prefixes = [...new Set(itemCodeMatchVariants(q))].filter((code) => code.length >= 1).slice(0, 8);
  const clauses = prefixes.map((prefix) => Prisma.sql`itemCode LIKE ${`${prefix}%`}`);
  // Longer numeric tails still match when the sheet stored extra leading zeros.
  if (/^\d{4,}$/.test(q)) clauses.push(Prisma.sql`itemCode LIKE ${`%${q}`}`);
  if (clauses.length === 0) return Prisma.sql`AND itemCode = ${q}`;
  return Prisma.sql`AND (${Prisma.join(clauses, " OR ")})`;
}

export async function searchOfficeItemCodes(
  importId: string,
  query: string,
  limit = 40,
  offset = 0
) {
  const take = Math.min(Math.max(limit, 1), 80);
  const skip = Math.max(offset, 0);

  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
    select: { columnMap: true, status: true },
  });
  if (!importRecord || importRecord.status !== "READY") return [];

  const columnMap = safeJsonObject(importRecord.columnMap ?? "{}") as Partial<OfficeFormsColumnMap>;
  const descriptionKey = columnMap.description;
  const codeFilter = currentUploadCodeFilter(query);

  // One query: first row per code (by sortOrder) — avoids a second findMany over 70k.
  const rows = await prisma.$queryRaw<
    Array<{ itemCode: string; payload: string }>
  >`
    SELECT i.itemCode as itemCode, i.payload as payload
    FROM OfficeReportInventoryItem i
    INNER JOIN (
      SELECT itemCode, MIN(sortOrder) AS minSort
      FROM OfficeReportInventoryItem
      WHERE importId = ${importId}
      ${codeFilter}
      GROUP BY itemCode
      ORDER BY itemCode ASC
      LIMIT ${take} OFFSET ${skip}
    ) first
      ON first.itemCode = i.itemCode AND first.minSort = i.sortOrder
    WHERE i.importId = ${importId}
    ORDER BY i.itemCode ASC
  `;

  return rows.map((row) => {
    const payload = safeJsonObject(row.payload ?? "{}") as Record<string, string>;
    return {
      itemCode: row.itemCode,
      itemName: (descriptionKey ? payload[descriptionKey] : "") || "",
    };
  });
}
