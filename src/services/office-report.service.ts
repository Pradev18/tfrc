import prisma from "@/lib/db";
import {
  lookupOfficeFormsFields,
  parseOfficeFormsWorkbook,
  type OfficeFormsColumnMap,
  type ParsedImageLink,
  type ParsedInventoryRow,
} from "@/lib/report/office-forms-parser";
import { normalizeItemCode } from "@/lib/report/office-forms-normalize";

const BATCH = 1000;

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

  const created = await prisma.officeReportImport.create({
    data: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      status: "READY",
      inventorySheetName: parsed.inventorySheetName,
      imageSheetName: parsed.imageSheetName,
      iqsSheetName: parsed.iqsSheetName,
      inventoryHeaders: JSON.stringify(parsed.inventoryHeaders),
      columnMap: JSON.stringify(parsed.columnMap),
      inventoryRowCount: parsed.inventoryRows.length,
      imageLinkCount: parsed.imageLinks.length,
      duplicateItemCodes: JSON.stringify(parsed.duplicateInventoryCodes),
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
        tfrcLabel: "TFRC",
      },
    });

    return { importRecord: created, report };
  } catch (error) {
    // Roll back partial import so we never mix incomplete source data.
    await prisma.officeReportImport.delete({ where: { id: created.id } }).catch(() => null);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save imported workbook data"
    );
  }
}

export async function listOfficeReports() {
  const reports = await prisma.officeReport.findMany({
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
      inventorySheetName: report.import.inventorySheetName,
      imageSheetName: report.import.imageSheetName,
      iqsSheetName: report.import.iqsSheetName,
      createdAt: report.import.createdAt.toISOString(),
    },
  }));
}

export async function getOfficeReportDetail(reportId: string) {
  const report = await prisma.officeReport.findUnique({
    where: { id: reportId },
    include: {
      import: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) return null;
  return serializeReport(report);
}

function serializeReport(
  report: NonNullable<Awaited<ReturnType<typeof prisma.officeReport.findUnique>> & {
    import: NonNullable<Awaited<ReturnType<typeof prisma.officeReportImport.findUnique>>>;
    lines: Array<{
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
    }>;
  }>
) {
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
    where: { importId, itemCode },
    orderBy: { sortOrder: "asc" },
    take: 10,
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
      lines: { select: { sortOrder: true } },
    },
  });
  if (!report) throw new Error("Report not found.");
  if (report.import.status !== "READY") {
    throw new Error("Report import is not ready. Upload a valid workbook first.");
  }

  const { itemCode, fields } = await resolveLookup(report.importId, itemCodeRaw);
  const nextOrder =
    report.lines.reduce((max, line) => Math.max(max, line.sortOrder), 0) + 1;

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
  return prisma.officeReport.update({
    where: { id: reportId },
    data: {
      ...(patch.customerName != null ? { customerName: patch.customerName } : {}),
      ...(patch.requestedBy != null ? { requestedBy: patch.requestedBy } : {}),
      ...(patch.shopBranch != null ? { shopBranch: patch.shopBranch } : {}),
      ...(patch.tfrcLabel != null ? { tfrcLabel: patch.tfrcLabel } : {}),
      ...(patch.notes != null ? { notes: patch.notes } : {}),
      ...(patch.reportDate != null ? { reportDate: patch.reportDate } : {}),
      ...(patch.title != null ? { title: patch.title } : {}),
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
  });
  if (!existing) throw new Error("Report line not found.");

  if (patch.itemCode != null && normalizeItemCode(patch.itemCode) !== existing.itemCode) {
    const report = await prisma.officeReport.findUnique({ where: { id: reportId } });
    if (!report) throw new Error("Report not found.");
    const { itemCode, fields } = await resolveLookup(report.importId, patch.itemCode);
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
          ? { wholesalePriceApproval: patch.wholesalePriceApproval }
          : {}),
      },
    });
  }

  return prisma.officeReportLine.update({
    where: { id: lineId },
    data: {
      ...(patch.wholesalePriceApproval != null
        ? { wholesalePriceApproval: patch.wholesalePriceApproval }
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

  await prisma.officeReport.delete({ where: { id: reportId } });

  // If this was the only report for the import, remove the import + source data too.
  if (siblingCount <= 1) {
    await prisma.officeReportImport.delete({ where: { id: importId } });
  }
}

export async function searchOfficeItemCodes(importId: string, query: string, limit = 20) {
  const q = normalizeItemCode(query);
  if (!q) return [];

  const importRecord = await prisma.officeReportImport.findUnique({
    where: { id: importId },
    select: { columnMap: true },
  });
  const columnMap = safeJsonObject(importRecord?.columnMap ?? "{}") as Partial<OfficeFormsColumnMap>;
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
