import * as XLSX from "xlsx";
import { Worker } from "node:worker_threads";
import fs from "node:fs";
import path from "node:path";
import { parsePriceString } from "@/lib/utils";
import { createProductSlug, createCategorySlug, parseCategoryPath } from "@/lib/slug";
import { validatePrices } from "@/lib/pricing";
import { extractPhoneFromWaLink } from "@/lib/whatsapp";

export interface CatalogRow {
  rowNumber: number;
  /** Excel serial_no — catalogue sequence for PDF / Serial no ↑↓ (1, 2, 3…). */
  serial_no: number | null;
  id: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  link: string;
  image_link: string;
  additional_image_link: string;
  brand: string;
  price: number;
  sale_price: number | null;
  google_product_category: string;
  fb_product_category: string;
  quantity_to_sell_on_facebook: number | null;
  sale_price_effective_date: string | null;
  video_url: string | null;
  video_tag: string | null;
  gtin: string | null;
  size: string | null;
  item_group_id: string | null;
  product_tags: string[];
  departmentSource: string;
}

export interface ParsedCatalog {
  rows: CatalogRow[];
  errors: Array<{ row: number; message: string }>;
  whatsappNumber: string | null;
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s.startsWith("=")) return s;
  return httpUrl(s);
}

/** Pull an http(s) URL out of a plain cell, a hyperlink target, or an Excel HYPERLINK formula. */
function httpUrl(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const match = raw.match(/https?:\/\/[^\s"')]+/i);
  return match ? match[0] : "";
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w.\[\]]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const ID_HEADERS = ["id", "product_id", "item_id", "item_code", "sku", "retailer_id"];
const TITLE_HEADERS = ["title", "name", "product_name", "item_name"];
const PRICE_HEADERS = ["price"];
const IMAGE_HEADERS = ["image_link", "image_url", "image", "picture", "photo", "main_image"];

function headerNames(row: unknown): string[] {
  if (!Array.isArray(row)) return [];
  return row.map((cell) => normalizeHeader(cell == null ? "" : String(cell)));
}

function isMetaHeaderRow(names: string[]): boolean {
  const set = new Set(names.filter(Boolean));
  return (
    ID_HEADERS.some((name) => set.has(name)) &&
    TITLE_HEADERS.some((name) => set.has(name)) &&
    PRICE_HEADERS.some((name) => set.has(name)) &&
    IMAGE_HEADERS.some((name) => set.has(name))
  );
}

/**
 * Meta files often put a title or instruction line above the real header.
 * Find that header, then turn the following rows into objects. Excel row
 * numbers stay accurate when `originRow` is the 1-based row of matrix[0].
 */
export function recordsFromSheetMatrix(
  matrix: unknown[][],
  originRow = 1
): Record<string, unknown>[] {
  if (matrix.length === 0) return [];
  let headerIndex = 0;
  const scan = Math.min(matrix.length, 40);
  for (let i = 0; i < scan; i++) {
    if (isMetaHeaderRow(headerNames(matrix[i]))) {
      headerIndex = i;
      break;
    }
  }

  const headers = headerNames(matrix[headerIndex]);
  const records: Record<string, unknown>[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const cells = Array.isArray(matrix[i]) ? matrix[i] : [];
    const record: Record<string, unknown> = { __excel_row: originRow + i };
    headers.forEach((name, col) => {
      if (!name) return;
      const current = record[name];
      if (current != null && current !== "") return;
      record[name] = cells[col] ?? "";
    });
    records.push(record);
  }
  return records;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );
}

function parseAdditionalImages(value: unknown): string[] {
  const str = cellStr(value);
  if (!str) return [];
  return str
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}

function parseItemNo(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  const raw = cellStr(value).replace(/,/g, "");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseTags(row: Record<string, unknown>): string[] {
  const tags: string[] = [];
  for (const key of Object.keys(row)) {
    if (key.startsWith("product_tags") && row[key]) {
      const t = cellStr(row[key]);
      if (t) tags.push(t);
    }
  }
  return tags;
}

function mapSheetRowsToCatalog(
  rawInput: Record<string, unknown>[],
  departmentSource: string
): ParsedCatalog {
  const raw = rawInput.map(normalizeRow);
  const rows: CatalogRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let whatsappNumber: string | null = null;
  const seenIds = new Set<string>();

  if (raw.length === 0) {
    errors.push({ row: 1, message: "The selected worksheet is empty" });
    return { rows, errors, whatsappNumber };
  }

  const headers = new Set(Object.keys(raw[0]!).filter((key) => key !== "__excel_row"));
  const requiredColumns = [
    { label: "id", aliases: ID_HEADERS },
    { label: "title", aliases: TITLE_HEADERS },
    { label: "price", aliases: PRICE_HEADERS },
    { label: "image_link", aliases: IMAGE_HEADERS },
  ];
  const missing = requiredColumns
    .filter((column) => !column.aliases.some((alias) => headers.has(alias)))
    .map((column) => column.label);
  if (missing.length > 0) {
    const found = [...headers].filter(Boolean).slice(0, 12).join(", ") || "(none)";
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message:
            `This is not a supported Meta catalogue Excel sheet. Missing required Meta columns: ${missing.join(", ")}. Columns found: ${found}.`,
        },
      ],
      whatsappNumber: null,
    };
  }

  raw.forEach((row, index) => {
    const marked = Number(row.__excel_row);
    const rowNum = Number.isInteger(marked) && marked > 0 ? marked : index + 2;
    const id = cellStr(row.id || row.product_id || row.item_id || row.item_code || row.sku);
    const title = cellStr(row.title || row.name || row.product_name || row.item_name);

    const priceValue = cellStr(row.price);
    const imageValue = httpUrl(
      row.image_link || row.image_url || row.image || row.picture || row.photo || row.main_image
    );
    const isBlankRow = !id && !title && !priceValue && !imageValue;
    if (isBlankRow) return;
    if (!id || !title) {
      errors.push({
        row: rowNum,
        message:
          "This row is incomplete in the Excel template. Fill both id and title, or delete the row.",
      });
      return;
    }
    if (seenIds.has(id)) {
      errors.push({ row: rowNum, message: `Duplicate product id ${id}` });
      return;
    }
    seenIds.add(id);

    const price = parsePriceString(row.price);
    if (price == null || price <= 0) {
      errors.push({ row: rowNum, message: `Invalid price for ${id}` });
      return;
    }

    const saleRaw = parsePriceString(row.sale_price);
    const salePrice: number | null = saleRaw;

    try {
      validatePrices(price, salePrice);
    } catch {
      errors.push({ row: rowNum, message: `Sale price must be lower than price for ${id}` });
      return;
    }

    const link = cellStr(row.link);
    if (link && !whatsappNumber) {
      whatsappNumber = extractPhoneFromWaLink(link);
    }

    const imageLink = httpUrl(
      row.image_link || row.image_url || row.image || row.picture || row.photo || row.main_image
    );
    if (!imageLink) {
      errors.push({
        row: rowNum,
        message: `Missing a web image link (https://...) for ${id}. The image_link cell must be a URL.`,
      });
      return;
    }

    const quantityRaw = cellStr(row.quantity_to_sell_on_facebook);
    const parsedQuantity = quantityRaw === "" ? null : Number.parseInt(quantityRaw, 10);
    if (
      quantityRaw !== "" &&
      (parsedQuantity === null || !Number.isInteger(parsedQuantity) || parsedQuantity < 0)
    ) {
      errors.push({ row: rowNum, message: `Invalid quantity for ${id}` });
      return;
    }

    rows.push({
      rowNumber: rowNum,
      // Excel serial_no (preferred) / legacy item_no / No = catalogue sequence.
      // Never use sheet row index (header is row 1; that wrongly made first item 2).
      serial_no:
        parseItemNo(
          row.serial_no ??
            row.serialno ??
            row["serial no"] ??
            row.serial_number ??
            row.item_no ??
            row.item_number ??
            row.itemno ??
            row["item no"] ??
            row.no ??
            row.number ??
            row["#"]
        ) ?? rows.length + 1,
      id,
      title,
      description: cellStr(row.description),
      availability: cellStr(row.availability) || "in stock",
      condition: cellStr(row.condition) || "new",
      link,
      image_link: imageLink,
      additional_image_link: cellStr(row.additional_image_link),
      brand: cellStr(row.brand) || "Unknown",
      price,
      sale_price: salePrice,
      google_product_category: cellStr(row.google_product_category),
      fb_product_category: cellStr(row.fb_product_category),
      quantity_to_sell_on_facebook:
        parsedQuantity !== null && Number.isInteger(parsedQuantity) && parsedQuantity >= 0
          ? parsedQuantity
          : null,
      sale_price_effective_date: cellStr(row.sale_price_effective_date) || null,
      video_url: cellStr(row["video[0].url"]) || null,
      video_tag: cellStr(row["video[0].tag[0]"]) || null,
      gtin: cellStr(row.gtin) || null,
      size: cellStr(row.size) || null,
      item_group_id: cellStr(row.item_group_id || row.item_group) || null,
      product_tags: parseTags(row),
      departmentSource,
    });
  });

  return { rows, errors, whatsappNumber };
}

function decodeCatalogueSheetOffThread(
  buffer: Buffer
): Promise<Record<string, unknown>[]> {
  const workerPath = path.join(
    process.cwd(),
    "scripts",
    "runtime",
    "catalogue-excel-parse-worker.cjs"
  );
  if (!fs.existsSync(workerPath)) {
    return Promise.reject(new Error("Catalogue Excel parser worker is unavailable."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerPath, {
      workerData: { buffer },
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(new Error("Catalogue Excel decoding timed out."));
    }, 120_000);

    function finish() {
      clearTimeout(timeout);
      void worker.terminate();
    }

    worker.once(
      "message",
      (message: {
        ok?: boolean;
        rows?: Record<string, unknown>[];
        matrix?: unknown[][];
        originRow?: number;
        error?: string;
      }) => {
        if (settled) return;
        settled = true;
        finish();
        if (message.ok && Array.isArray(message.matrix)) {
          resolve(
            recordsFromSheetMatrix(
              message.matrix,
              Number.isInteger(message.originRow) ? message.originRow : 1
            )
          );
          return;
        }
        if (!message.ok || !Array.isArray(message.rows)) {
          reject(new Error(message.error || "Catalogue Excel decoding failed."));
          return;
        }
        resolve(message.rows);
      }
    );
    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      finish();
      reject(error);
    });
    worker.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        reject(new Error("Catalogue Excel parser worker exited without a result."));
      } else {
        reject(new Error(`Catalogue Excel parser worker exited with code ${code}.`));
      }
    });
  });
}

/** Sync parse kept for seed/scripts. Prefer parseExcelBufferAsync in HTTP handlers. */
export function parseExcelBuffer(
  buffer: Buffer,
  departmentSource: string
): ParsedCatalog {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((s) => s.toLowerCase().includes("meta")) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      rows: [],
      errors: [{ row: 1, message: "The workbook does not contain a readable worksheet" }],
      whatsappNumber: null,
    };
  }
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const withLinks = matrix.map((row, rowIndex) => {
    if (!Array.isArray(row) || !range) return row;
    return row.map((cell, colIndex) => {
      const addr = XLSX.utils.encode_cell({
        r: range.s.r + rowIndex,
        c: range.s.c + colIndex,
      });
      const target = sheet[addr]?.l?.Target;
      return typeof target === "string" && target.startsWith("http") ? target : cell;
    });
  });
  return mapSheetRowsToCatalog(
    recordsFromSheetMatrix(withLinks, range ? range.s.r + 1 : 1),
    departmentSource
  );
}

/** Production path: decode XLSX off the event loop, then map rows. */
export async function parseExcelBufferAsync(
  buffer: Buffer,
  departmentSource: string
): Promise<ParsedCatalog> {
  try {
    const raw = await decodeCatalogueSheetOffThread(buffer);
    return mapSheetRowsToCatalog(raw, departmentSource);
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error instanceof Error
        ? error
        : new Error("Catalogue Excel decoding failed.");
    }
    console.warn(
      "[catalogue-import] parser worker unavailable; using inline fallback:",
      error
    );
    return parseExcelBuffer(buffer, departmentSource);
  }
}

export function rowToProductSlug(row: CatalogRow): string {
  return createProductSlug(row.title, row.id);
}

export function rowImages(row: CatalogRow): string[] {
  const images = [row.image_link, ...parseAdditionalImages(row.additional_image_link)];
  return [...new Set(images.filter(Boolean))];
}

export function rowCategorySegments(row: CatalogRow): string[] {
  if (row.google_product_category) {
    return parseCategoryPath(row.google_product_category);
  }
  if (row.fb_product_category) {
    return parseCategoryPath(row.fb_product_category);
  }
  return [row.departmentSource];
}

export { createCategorySlug, parseCategoryPath };

export const CATALOG_FILES = [
  {
    name: "Pet Products",
    path: "data/Pet Products WhatsApp_Catalog_FINAL_UPLOAD.xlsx",
    department: "Pet Products",
  },
  {
    name: "Households",
    path: "data/House Holds WhatsApp_Catalog_UPLOAD_READY.xlsx",
    department: "Households",
  },
  {
    name: "Multi Tools",
    path: "data/Mutli Tools WhatsApp_Catalog_401_FINAL_UPLOAD.xlsx",
    department: "Multi Tools",
  },
] as const;

export function readCatalogFile(filePath: string, department: string): ParsedCatalog {
  const buffer = fs.readFileSync(filePath);
  return parseExcelBuffer(buffer, department);
}
