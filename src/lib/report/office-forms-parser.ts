import * as XLSX from "xlsx";
import {
  findHeaderIndex,
  headersInclude,
  normalizeHeader,
  normalizeItemCode,
} from "@/lib/report/office-forms-normalize";
import { pickPreferredImageUrl } from "@/lib/report/report-image-src";
import {
  assertExcelBuffer,
  explainExcelParseFailure,
} from "@/lib/report/excel-file-guard";

export interface ParsedInventoryRow {
  itemCode: string;
  payload: Record<string, string>;
}

export interface ParsedImageLink {
  itemCode: string;
  imageUrl: string;
  fileName?: string;
}

export interface OfficeFormsColumnMap {
  itemCode: string;
  description: string;
  supplierName: string;
  itemCost: string;
  retailPrice: string;
  onHand: string;
  /** 1-based Excel column indexes used by the I.Q.S template (informational). */
  vlookupIndexes?: Record<string, number>;
}

export interface ParsedIqsSeedRow {
  itemCode: string;
  wholesalePriceApproval: string;
}

export interface ParsedIqsFormMeta {
  customerName: string;
  requestedBy: string;
  shopBranch: string;
  reportDate: string;
  notes: string;
  tfrcLabel: string;
}

export interface ParsedOfficeFormsWorkbook {
  inventorySheetName: string;
  imageSheetName: string | null;
  iqsSheetName: string | null;
  inventoryHeaders: string[];
  columnMap: OfficeFormsColumnMap;
  inventoryRows: ParsedInventoryRow[];
  imageLinks: ParsedImageLink[];
  /** Item codes already filled on the I.Q.S sheet (seed report lines). */
  iqsSeedRows: ParsedIqsSeedRow[];
  iqsFormMeta: ParsedIqsFormMeta;
  duplicateInventoryCodes: string[];
  duplicateImageCodes: string[];
}

function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    // Keep meaningful decimals for costs/prices
    return String(value);
  }
  return String(value).trim();
}

function scoreInventorySheet(headers: string[]): number {
  let score = 0;
  if (findHeaderIndex(headers, ["item code", "itemcode"]) >= 0) score += 5;
  if (findHeaderIndex(headers, ["supplier name"]) >= 0) score += 3;
  if (findHeaderIndex(headers, ["description", "item name"]) >= 0) score += 3;
  if (findHeaderIndex(headers, ["item cost"]) >= 0) score += 2;
  if (findHeaderIndex(headers, ["retail price", "selling price"]) >= 0) score += 2;
  if (findHeaderIndex(headers, ["boh", "total qty", "on hand"]) >= 0) score += 2;
  return score;
}

function scoreImageSheet(headers: string[]): number {
  let score = 0;
  if (findHeaderIndex(headers, ["link", "image link", "url"]) >= 0) score += 4;
  if (findHeaderIndex(headers, ["file name", "filename", "r2 key"]) >= 0) score += 2;
  if (headersInclude(headers, "batch")) score += 1;
  return score;
}

function scoreIqsSheet(headers: string[]): number {
  let score = 0;
  if (findHeaderIndex(headers, ["item code", "itemcode"]) >= 0) score += 3;
  if (findHeaderIndex(headers, ["image link"]) >= 0) score += 2;
  if (findHeaderIndex(headers, ["whole sale price approval", "wholesale price approval"]) >= 0)
    score += 4;
  if (findHeaderIndex(headers, ["on hand"]) >= 0) score += 2;
  if (findHeaderIndex(headers, ["supplier name"]) >= 0) score += 1;
  return score;
}

function findHeaderRow(rows: unknown[][], minScore: (h: string[]) => number): number {
  let bestIdx = -1;
  let best = 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const headers = (rows[i] ?? []).map((c) => cellToString(c));
    if (headers.every((h) => !h)) continue;
    const score = minScore(headers);
    if (score > best) {
      best = score;
      bestIdx = i;
    }
  }
  return best >= 4 ? bestIdx : bestIdx >= 0 && best >= 3 ? bestIdx : -1;
}

function pickSheet(
  workbook: XLSX.WorkBook,
  preferNames: string[],
  scorer: (headers: string[]) => number
): { name: string; headerRow: number; headers: string[]; rows: unknown[][] } | null {
  const candidates: Array<{
    name: string;
    headerRow: number;
    headers: string[];
    rows: unknown[][];
    score: number;
    nameBonus: number;
  }> = [];

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const rows = sheetRows(ws);
    const headerRow = findHeaderRow(rows, scorer);
    if (headerRow < 0) continue;
    const headers = (rows[headerRow] ?? []).map((c) => cellToString(c));
    const score = scorer(headers);
    const lower = name.toLowerCase();
    const nameBonus = preferNames.some((p) => lower.includes(p.toLowerCase())) ? 10 : 0;
    candidates.push({ name, headerRow, headers, rows, score, nameBonus });
  }

  candidates.sort((a, b) => b.score + b.nameBonus - (a.score + a.nameBonus));
  const best = candidates[0];
  if (!best || best.score < 4) return null;
  return best;
}

function buildColumnMap(headers: string[]): OfficeFormsColumnMap {
  const itemCodeIdx = findHeaderIndex(headers, ["item code", "itemcode"]);
  const descriptionIdx = findHeaderIndex(headers, ["description", "item name", "product name"]);
  const supplierIdx = findHeaderIndex(headers, ["supplier name"]);
  const costIdx = findHeaderIndex(headers, ["item cost"]);
  const retailIdx = findHeaderIndex(headers, ["retail price", "selling price"]);
  const onHandIdx = findHeaderIndex(headers, ["boh", "on hand", "total qty", "total quantity"]);

  if (itemCodeIdx < 0) {
    throw new Error("Item inventory sheet is missing an Item Code column.");
  }
  if (descriptionIdx < 0) {
    throw new Error("Item inventory sheet is missing a Description / Item Name column.");
  }
  if (supplierIdx < 0) {
    throw new Error("Item inventory sheet is missing a Supplier Name column.");
  }
  if (costIdx < 0) {
    throw new Error("Item inventory sheet is missing an Item Cost column.");
  }
  if (retailIdx < 0) {
    throw new Error("Item inventory sheet is missing a Retail / Selling Price column.");
  }
  if (onHandIdx < 0) {
    throw new Error("Item inventory sheet is missing an On Hand / BOH / Total Qty column.");
  }

  return {
    itemCode: headers[itemCodeIdx]!,
    description: headers[descriptionIdx]!,
    supplierName: headers[supplierIdx]!,
    itemCost: headers[costIdx]!,
    retailPrice: headers[retailIdx]!,
    onHand: headers[onHandIdx]!,
    vlookupIndexes: {
      description: descriptionIdx + 1,
      supplierName: supplierIdx + 1,
      itemCost: costIdx + 1,
      retailPrice: retailIdx + 1,
      onHand: onHandIdx + 1,
    },
  };
}

function formatMoneyish(value: string): string {
  if (!value) return "";
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseOfficeFormsWorkbook(
  buffer: Buffer,
  fileName = "workbook.xlsx"
): ParsedOfficeFormsWorkbook {
  assertExcelBuffer(buffer, fileName);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      dense: false,
    });
  } catch (error) {
    throw explainExcelParseFailure(error, fileName);
  }

  if (!workbook.SheetNames.length) {
    throw new Error(
      `Excel problem in “${fileName}”: the workbook has no sheets. Open it in Excel and confirm the tabs are present.`
    );
  }

  const inventory = pickSheet(
    workbook,
    ["item_qty", "item qty", "qty_in_store", "qty in store", "store inventory"],
    scoreInventorySheet
  );
  if (!inventory) {
    const sheetList = workbook.SheetNames.join(", ");
    throw new Error(
      `Excel problem in “${fileName}”: could not find an Item_Qty_in_Store sheet. Expected headers like Item Code, Description, Supplier Name, Item Cost, Retail Price, and BOH/On Hand. Sheets found: ${sheetList || "(none)"}.`
    );
  }

  let columnMap: OfficeFormsColumnMap;
  try {
    columnMap = buildColumnMap(inventory.headers);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Excel problem in “${fileName}” on sheet “${inventory.name}”: ${msg}`
    );
  }

  const imageSheet = pickSheet(
    workbook,
    ["cloud fare", "cloudfare", "cloudflare", "image", "r2"],
    scoreImageSheet
  );

  const iqsSheet = pickSheet(
    workbook,
    ["i.q.s", "iqs", "inventory price check", "price check"],
    scoreIqsSheet
  );

  const inventoryRows: ParsedInventoryRow[] = [];
  const codeCounts = new Map<string, number>();

  const mappedHeaders = [
    columnMap.itemCode,
    columnMap.description,
    columnMap.supplierName,
    columnMap.itemCost,
    columnMap.retailPrice,
    columnMap.onHand,
  ];
  const headerIndex = new Map(
    inventory.headers.map((header, idx) => [header, idx] as const)
  );

  for (let r = inventory.headerRow + 1; r < inventory.rows.length; r++) {
    const row = inventory.rows[r] ?? [];
    const itemCodeIdx = headerIndex.get(columnMap.itemCode) ?? -1;
    const itemCode = normalizeItemCode(itemCodeIdx >= 0 ? row[itemCodeIdx] : "");
    if (!itemCode) continue;
    // Skip header-like accidental repeats
    if (normalizeHeader(itemCode) === "item code") continue;

    // Persist only I.Q.S-mapped source fields (immutable snapshot for this import).
    const payload: Record<string, string> = {};
    for (const header of mappedHeaders) {
      const idx = headerIndex.get(header);
      payload[header] = idx != null ? cellToString(row[idx]) : "";
    }
    codeCounts.set(itemCode, (codeCounts.get(itemCode) ?? 0) + 1);
    inventoryRows.push({ itemCode, payload });
  }

  if (inventoryRows.length === 0) {
    throw new Error(
      `Excel problem in “${fileName}” on sheet “${inventory.name}”: no usable item rows with Item Code were found.`
    );
  }

  const imageLinks: ParsedImageLink[] = [];
  const imageCounts = new Map<string, number>();
  if (imageSheet) {
    const codeIdx = findHeaderIndex(imageSheet.headers, [
      "file name",
      "filename",
      "item code",
      "itemcode",
    ]);
    const linkIdx = findHeaderIndex(imageSheet.headers, ["link", "image link", "url"]);
    if (codeIdx >= 0 && linkIdx >= 0) {
      for (let r = imageSheet.headerRow + 1; r < imageSheet.rows.length; r++) {
        const row = imageSheet.rows[r] ?? [];
        const rawName = cellToString(row[codeIdx]);
        // Cloud Fare keys are often filenames; strip image extensions for item-code match.
        const itemCode = normalizeItemCode(rawName.replace(/\.(jpe?g|png|webp|gif)$/i, ""));
        const imageUrl = cellToString(row[linkIdx]);
        if (!itemCode || !imageUrl) continue;
        if (!/^https?:\/\//i.test(imageUrl)) continue;
        imageCounts.set(itemCode, (imageCounts.get(itemCode) ?? 0) + 1);
        imageLinks.push({
          itemCode,
          imageUrl,
          fileName: rawName || undefined,
        });
      }
    }
  }

  const { seedRows: iqsSeedRows, formMeta: iqsFormMeta } = extractIqsSeed(
    iqsSheet?.rows ?? [],
    iqsSheet?.headerRow ?? -1
  );

  return {
    inventorySheetName: inventory.name,
    imageSheetName: imageSheet?.name ?? null,
    iqsSheetName: iqsSheet?.name ?? null,
    inventoryHeaders: inventory.headers.filter(Boolean),
    columnMap,
    inventoryRows,
    imageLinks,
    iqsSeedRows,
    iqsFormMeta,
    duplicateInventoryCodes: [...codeCounts.entries()]
      .filter(([, n]) => n > 1)
      .map(([code]) => code),
    duplicateImageCodes: [...imageCounts.entries()]
      .filter(([, n]) => n > 1)
      .map(([code]) => code),
  };
}

function extractIqsSeed(
  rows: unknown[][],
  headerRow: number
): { seedRows: ParsedIqsSeedRow[]; formMeta: ParsedIqsFormMeta } {
  const formMeta: ParsedIqsFormMeta = {
    customerName: "",
    requestedBy: "",
    shopBranch: "",
    reportDate: "",
    notes: "",
    tfrcLabel: "TFRC",
  };

  if (headerRow < 0 || rows.length === 0) {
    return { seedRows: [], formMeta };
  }

  // Best-effort form values from rows above the table header (blank in template is fine).
  const knownLabels = new Set(
    [
      "customer name",
      "requested by",
      "shop / branch",
      "shop",
      "branch",
      "notes",
      "date",
      "tfrc",
      "inventory availability & price check",
      "the first retail company (w.l.l)",
      "the first retail company (w.l.l.)",
    ].map((v) => normalizeHeader(v))
  );

  const labelMap: Array<{ aliases: string[]; key: keyof ParsedIqsFormMeta }> = [
    { aliases: ["customer name"], key: "customerName" },
    { aliases: ["requested by"], key: "requestedBy" },
    { aliases: ["shop / branch"], key: "shopBranch" },
    { aliases: ["notes"], key: "notes" },
    { aliases: ["date"], key: "reportDate" },
    { aliases: ["tfrc"], key: "tfrcLabel" },
  ];

  function isLabelLike(value: string): boolean {
    const n = normalizeHeader(value);
    if (!n) return true;
    if (knownLabels.has(n)) return true;
    return labelMap.some((entry) =>
      entry.aliases.some((alias) => n === alias || n.includes(alias))
    );
  }

  for (let r = 0; r < headerRow; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const label = normalizeHeader(row[c]);
      if (!label) continue;
      const match = labelMap.find((entry) => entry.aliases.some((alias) => label === alias));
      if (!match) continue;

      // Prefer the cell directly under the label (Excel form layout).
      const below = cellToString((rows[r + 1] ?? [])[c]);
      let value = below && !isLabelLike(below) ? below : "";

      // Fallback: next cell on same row only if it is not another field label.
      if (!value) {
        for (let k = c + 1; k < Math.min(row.length, c + 3); k++) {
          const candidate = cellToString(row[k]);
          if (!candidate || isLabelLike(candidate)) continue;
          value = candidate;
          break;
        }
      }

      if (value) formMeta[match.key] = value;
    }
  }

  const headers = (rows[headerRow] ?? []).map((c) => cellToString(c));
  const codeIdx = findHeaderIndex(headers, ["item code", "itemcode"]);
  const wholesaleIdx = findHeaderIndex(headers, [
    "whole sale price approval",
    "wholesale price approval",
    "wholesale",
  ]);
  if (codeIdx < 0) return { seedRows: [], formMeta };

  const seedRows: ParsedIqsSeedRow[] = [];
  const seen = new Set<string>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const itemCode = normalizeItemCode(row[codeIdx]);
    if (!itemCode) continue;
    if (normalizeHeader(itemCode) === "item code") continue;
    if (seen.has(itemCode)) continue;
    seen.add(itemCode);
    const wholesaleRaw =
      wholesaleIdx >= 0 ? cellToString(row[wholesaleIdx]) : "";
    const wholesalePriceApproval =
      !wholesaleRaw || wholesaleRaw === " " ? "" : wholesaleRaw;
    seedRows.push({ itemCode, wholesalePriceApproval });
  }

  return { seedRows, formMeta };
}

export function lookupOfficeFormsFields(
  parsed: Pick<ParsedOfficeFormsWorkbook, "columnMap">,
  inventoryMatches: ParsedInventoryRow[],
  imageMatches: ParsedImageLink[]
): {
  itemName: string;
  supplierName: string;
  onHand: string;
  itemCost: string;
  sellingPrice: string;
  imageLink: string;
  lookupStatus: "ok" | "not_found" | "duplicate";
  lookupWarning: string | null;
} {
  if (inventoryMatches.length === 0) {
    return {
      itemName: "",
      supplierName: "",
      onHand: "",
      itemCost: "",
      sellingPrice: "",
      imageLink: pickPreferredImageLikeExcel(imageMatches),
      lookupStatus: "not_found",
      lookupWarning: "Item code not found in the uploaded Item_Qty_in_Store data.",
    };
  }

  // Excel VLOOKUP(...,0) returns the first sheet-order match.
  const chosen = inventoryMatches[0]!;
  const map = parsed.columnMap;
  const imageLink = pickPreferredImageLikeExcel(imageMatches);

  const warnings: string[] = [];
  // Only inventory duplicates are a data-integrity warning (status=duplicate).
  // Multiple Cloud Fare formats (jpg/png) are normal — Excel still returns the first.
  if (inventoryMatches.length > 1) {
    warnings.push(
      `Duplicate item code in inventory (${inventoryMatches.length} rows). Showing the first match — review before approving.`
    );
  }
  if (imageMatches.length > 1) {
    warnings.push(
      `Multiple image links found (${imageMatches.length}). Using the first sheet-order match (Excel VLOOKUP behaviour).`
    );
  }

  return {
    itemName: chosen.payload[map.description] ?? "",
    supplierName: chosen.payload[map.supplierName] ?? "",
    onHand: chosen.payload[map.onHand] ?? "",
    itemCost: formatMoneyish(chosen.payload[map.itemCost] ?? ""),
    sellingPrice: formatMoneyish(chosen.payload[map.retailPrice] ?? ""),
    imageLink,
    lookupStatus: inventoryMatches.length > 1 ? "duplicate" : "ok",
    lookupWarning: warnings.length ? warnings.join(" ") : null,
  };
}

/**
 * Prefer a usable photo format when Cloud Fare lists several files for one code
 * (e.g. .jpg + .emf). Ties keep earlier sheet order.
 */
function pickPreferredImageLikeExcel(links: ParsedImageLink[]): string {
  return pickPreferredImageUrl(links.map((l) => l.imageUrl));
}
