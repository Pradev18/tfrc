import prisma from "@/lib/db";
import {
  lookupOfficeFormsFields,
  parseOfficeFormsWorkbook,
  type OfficeFormsColumnMap,
  type ParsedImageLink,
  type ParsedInventoryRow,
} from "@/lib/report/office-forms-parser";
import { normalizeItemCode } from "@/lib/report/office-forms-normalize";
import {
  itemCodeMatchVariants,
  pickPreferredImageUrl,
} from "@/lib/report/report-image-src";

const BATCH = 500;
/** Hostinger-safe: keep each seed request small so Cloudflare/proxy does not time out. */
const SEED_BATCH = 250;

export async function createOfficeReportImport(input: {
  fileName: string;
  fileSize: number;
  buffer: Buffer;
  userId?: string | null;
}) {
  let parsed;
  try {
    parsed = parseOfficeFormsWorkbook(input.buffer);
  } catch (error) {
    // Do not persist orphan FAILED imports — surface a clear validation error only.
    throw new Error(error instanceof Error ? error.message : "Failed to parse workbook");
  }

  const uniqueCodes = new Set(parsed.inventoryRows.map((row) => row.itemCode));
  const wholesaleByCode: Record<string, string> = {};
  for (const seed of parsed.iqsSeedRows) {
    wholesaleByCode[seed.itemCode] = seed.wholesalePriceApproval;
  }

  // Stay PENDING until chunked seeding finishes. Mid-import data must not be used for PDF.
  const created = await prisma.officeReportImport.create({
    data: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      status: "PENDING",
      inventorySheetName: parsed.inventorySheetName,
      imageSheetName: parsed.imageSheetName,
      iqsSheetName: parsed.iqsSheetName,
      inventoryHeaders: JSON.stringify(parsed.inventoryHeaders),
      columnMap: JSON.stringify(parsed.columnMap),
      inventoryRowCount: parsed.inventoryRows.length,
      imageLinkCount: parsed.imageLinks.length,
      duplicateItemCodes: JSON.stringify(parsed.duplicateInventoryCodes),
      uniqueItemCount: uniqueCodes.size,
      seedProgress: 0,
      iqsWholesaleByCode: JSON.stringify(wholesaleByCode),
      createdByUserId: input.userId ?? null,
    },
  });

  try {
    for (let i = 0; i < parsed.inventoryRows.length; i += BATCH) {
      const chunk = parsed.inventoryRows.slice(i, i + BATCH);
      await prisma.officeReportInventoryItem.createMany({
        data: chunk.map((row, offset) => ({
          importId: created.id,
          itemCode: row.itemCode,
          payload: JSON.stringify(row.payload),
          sortOrder: i + offset,
        })),
      });
    }

    for (let i = 0; i < parsed.imageLinks.length; i += BATCH) {
      const chunk = parsed.imageLinks.slice(i, i + BATCH);
      await prisma.officeReportImageLink.createMany({
        data: chunk.map((row, offset) => ({
          importId: created.id,
          itemCode: row.itemCode,
          imageUrl: row.imageUrl,
          fileName: row.fileName ?? null,
          sortOrder: i + offset,
        })),
      });
    }

    const report = await prisma.officeReport.create({
      data: {
        importId: created.id,
        createdByUserId: input.userId ?? null,
        tfrcLabel: parsed.iqsFormMeta.tfrcLabel || "TFRC",
        customerName: parsed.iqsFormMeta.customerName,
        requestedBy: parsed.iqsFormMeta.requestedBy,
        shopBranch: parsed.iqsFormMeta.shopBranch,
        notes: parsed.iqsFormMeta.notes,
        reportDate: formatIqsReportDate(parsed.iqsFormMeta.reportDate),
      },
    });

    // Free parsed workbook ASAP — seeding continues in small HTTP batches.
    parsed = null as unknown as typeof parsed;

    const importRecord = await prisma.officeReportImport.findUniqueOrThrow({
      where: { id: created.id },
    });

    return {
      importRecord,
      report,
      seededLineCount: 0,
      uniqueItemCount: uniqueCodes.size,
      needsSeed: uniqueCodes.size > 0,
    };
  } catch (error) {
    await prisma.officeReportImport.delete({ where: { id: created.id } }).catch(() => null);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save imported workbook data"
    );
  }
}

/**
 * Seed the next chunk of unique inventory originals into report lines.
 * Call repeatedly until `done` is true (Hostinger / Cloudflare safe).
 */
export async function seedOfficeReportLinesBatch(
  reportId: string,
  batchSize = SEED_BATCH
) {
  const take = Math.min(Math.max(batchSize, 50), 500);
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: { import: true },
  });
  if (!report) throw new Error("Report not found.");
  if (report.import.status === "FAILED") {
    throw new Error(report.import.errorMessage || "Import failed.");
  }
  if (report.import.status === "READY") {
    return {
      done: true,
      seeded: report.import.seedProgress,
      total: report.import.uniqueItemCount,
      progress: report.import.seedProgress,
    };
  }

  const offset = report.import.seedProgress;
  const total = report.import.uniqueItemCount;
  if (total <= 0) {
    await prisma.officeReportImport.update({
      where: { id: report.importId },
      data: { status: "READY", seedProgress: 0, errorMessage: null },
    });
    return { done: true, seeded: 0, total: 0, progress: 0 };
  }

  const uniqueRows = await prisma.$queryRaw<
    Array<{ itemCode: string; firstOrder: number | bigint }>
  >`
    SELECT itemCode as itemCode, MIN(sortOrder) as firstOrder
    FROM OfficeReportInventoryItem
    WHERE importId = ${report.importId}
    GROUP BY itemCode
    ORDER BY firstOrder ASC
    LIMIT ${take} OFFSET ${offset}
  `;

  if (uniqueRows.length === 0) {
    await prisma.officeReportImport.update({
      where: { id: report.importId },
      data: { status: "READY", seedProgress: total, errorMessage: null },
    });
    return { done: true, seeded: 0, total, progress: total };
  }

  const wholesaleByCode = safeJsonObject(report.import.iqsWholesaleByCode) as Record<
    string,
    string
  >;
  const codes = uniqueRows.map((row) => row.itemCode);
  const codeVariants = [...new Set(codes.flatMap((c) => itemCodeMatchVariants(c)))];

  const inventoryMatches = await prisma.officeReportInventoryItem.findMany({
    where: { importId: report.importId, itemCode: { in: codes } },
    orderBy: [{ itemCode: "asc" }, { sortOrder: "asc" }],
  });
  const imageMatches = await prisma.officeReportImageLink.findMany({
    where: { importId: report.importId, itemCode: { in: codeVariants } },
    orderBy: [{ itemCode: "asc" }, { sortOrder: "asc" }],
  });

  const invByCode = new Map<string, typeof inventoryMatches>();
  for (const row of inventoryMatches) {
    const list = invByCode.get(row.itemCode) ?? [];
    list.push(row);
    invByCode.set(row.itemCode, list);
  }
  const imgByCode = new Map<string, typeof imageMatches>();
  for (const row of imageMatches) {
    // Index under every match variant so IQS codes find Cloud Fare rows with
    // different leading-zero padding.
    for (const key of itemCodeMatchVariants(row.itemCode)) {
      const list = imgByCode.get(key) ?? [];
      list.push(row);
      imgByCode.set(key, list);
    }
  }

  const columnMap = safeJsonObject(report.import.columnMap) as unknown as OfficeFormsColumnMap;
  const lineData = codes.map((itemCode, index) => {
    const invRows = invByCode.get(itemCode) ?? [];
    const imgRows = imgByCode.get(itemCode) ?? [];
    const fields = lookupOfficeFormsFields(
      { columnMap },
      invRows.map((row) => ({
        itemCode: row.itemCode,
        payload: safeJsonObject(row.payload) as Record<string, string>,
      })),
      imgRows.map((row) => ({
        itemCode: row.itemCode,
        imageUrl: row.imageUrl,
        fileName: row.fileName ?? undefined,
      }))
    );
    return {
      reportId,
      sortOrder: offset + index + 1,
      itemCode,
      imageLink: fields.imageLink,
      itemName: fields.itemName,
      supplierName: fields.supplierName,
      onHand: fields.onHand,
      itemCost: fields.itemCost,
      sellingPrice: fields.sellingPrice,
      wholesalePriceApproval: wholesaleByCode[itemCode] ?? "",
      lookupStatus: fields.lookupStatus,
      lookupWarning:
        invRows.length > 1
          ? `Duplicate in source inventory (${invRows.length} rows). Original (first) row is used in the report/PDF.`
          : fields.lookupWarning,
    };
  });

  await prisma.officeReportLine.createMany({ data: lineData });

  const nextProgress = offset + lineData.length;
  const done = nextProgress >= total;
  await prisma.officeReportImport.update({
    where: { id: report.importId },
    data: {
      seedProgress: nextProgress,
      status: done ? "READY" : "PENDING",
      errorMessage: null,
    },
  });

  return {
    done,
    seeded: lineData.length,
    total,
    progress: nextProgress,
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
    where: { import: { status: { in: ["READY", "PENDING"] } } },
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
  const lines = await enrichLinesWithPreferredImages(
    report.importId,
    serialized.lines
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
      total: report.import.uniqueItemCount,
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
    if (!preferred || preferred === line.imageLink) return line;
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
  const inventoryMatches = await prisma.officeReportInventoryItem.findMany({
    where: { importId, itemCode },
    orderBy: { sortOrder: "asc" },
    take: 10,
  });
  const imageMatches = await prisma.officeReportImageLink.findMany({
    where: { importId, itemCode: { in: itemCodeMatchVariants(itemCode) } },
    orderBy: { sortOrder: "asc" },
    take: 50,
  });

  const parsedInventory: ParsedInventoryRow[] = inventoryMatches.map((row) => ({
    itemCode: row.itemCode,
    payload: safeJsonObject(row.payload) as Record<string, string>,
  }));
  const parsedImages: ParsedImageLink[] = imageMatches.map((row) => ({
    itemCode: row.itemCode,
    imageUrl: row.imageUrl,
    fileName: row.fileName ?? undefined,
  }));

  const fields = lookupOfficeFormsFields(
    { columnMap },
    parsedInventory,
    parsedImages
  );

  return { itemCode, fields };
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
    throw new Error("Report import is not ready. Upload a valid workbook first.");
  }

  const { itemCode, fields } = await resolveLookup(report.importId, itemCodeRaw);

  const existingLine = await prisma.officeReportLine.findFirst({
    where: { reportId, itemCode },
    select: { id: true },
  });
  if (existingLine) {
    throw new Error(
      `Item code ${itemCode} is already on this report. Duplicates are listed separately and omitted from the PDF.`
    );
  }

  const agg = await prisma.officeReportLine.aggregate({
    where: { reportId },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? 0) + 1;

  return prisma.officeReportLine.create({
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
      wholesalePriceApproval: "",
      lookupStatus: fields.lookupStatus,
      lookupWarning: fields.lookupWarning,
    },
  });
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
    const { itemCode, fields } = await resolveLookup(
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
        lookupStatus: fields.lookupStatus,
        lookupWarning: fields.lookupWarning,
        ...(patch.wholesalePriceApproval != null
          ? { wholesalePriceApproval: String(patch.wholesalePriceApproval) }
          : {}),
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

export async function searchOfficeItemCodes(importId: string, query: string, limit = 20) {
  const q = normalizeItemCode(query);
  if (!q) return [];

  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
    select: { columnMap: true, status: true },
  });
  if (!importRecord || importRecord.status !== "READY") return [];

  const columnMap = safeJsonObject(importRecord.columnMap ?? "{}") as Partial<OfficeFormsColumnMap>;
  const descriptionKey = columnMap.description;

  const rows = await prisma.officeReportInventoryItem.findMany({
    where: {
      importId,
      itemCode: { contains: q },
    },
    distinct: ["itemCode"],
    take: limit,
    orderBy: [{ itemCode: "asc" }, { sortOrder: "asc" }],
    select: { itemCode: true, payload: true },
  });

  return rows.map((row) => {
    const payload = safeJsonObject(row.payload) as Record<string, string>;
    return {
      itemCode: row.itemCode,
      itemName: (descriptionKey ? payload[descriptionKey] : "") || "",
    };
  });
}
