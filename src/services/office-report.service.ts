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

  // Stay PENDING until every batch + seeded line is written. Mid-import data must
  // never be used for lookups, preview, or edits.
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

    let seededLineCount = 0;
    // Prefill report rows from item codes already present on the I.Q.S sheet.
    if (parsed.iqsSeedRows.length > 0) {
      const invByCode = new Map<string, ParsedInventoryRow[]>();
      for (const row of parsed.inventoryRows) {
        const list = invByCode.get(row.itemCode) ?? [];
        list.push(row);
        invByCode.set(row.itemCode, list);
      }
      const imgByCode = new Map<string, ParsedImageLink[]>();
      for (const row of parsed.imageLinks) {
        const list = imgByCode.get(row.itemCode) ?? [];
        list.push(row);
        imgByCode.set(row.itemCode, list);
      }

      const lineData = parsed.iqsSeedRows.map((seed, index) => {
        const fields = lookupOfficeFormsFields(
          parsed,
          invByCode.get(seed.itemCode) ?? [],
          imgByCode.get(seed.itemCode) ?? []
        );
        return {
          reportId: report.id,
          sortOrder: index + 1,
          itemCode: seed.itemCode,
          imageLink: fields.imageLink,
          itemName: fields.itemName,
          supplierName: fields.supplierName,
          onHand: fields.onHand,
          itemCost: fields.itemCost,
          sellingPrice: fields.sellingPrice,
          wholesalePriceApproval: seed.wholesalePriceApproval,
          lookupStatus: fields.lookupStatus,
          lookupWarning: fields.lookupWarning,
        };
      });

      for (let i = 0; i < lineData.length; i += BATCH) {
        await prisma.officeReportLine.createMany({
          data: lineData.slice(i, i + BATCH),
        });
      }
      seededLineCount = lineData.length;
    }

    const importRecord = await prisma.officeReportImport.update({
      where: { id: created.id },
      data: { status: "READY", errorMessage: null },
    });

    return { importRecord, report, seededLineCount };
  } catch (error) {
    // Roll back partial import so we never mix incomplete source data.
    await prisma.officeReportImport.delete({ where: { id: created.id } }).catch(() => null);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save imported workbook data"
    );
  }
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
    where: { import: { status: "READY" } },
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
  if (report.import.status !== "READY") return null;
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
