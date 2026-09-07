import * as XLSX from "xlsx";
import { parsePriceString } from "@/lib/utils";
import { createProductSlug, createCategorySlug, parseCategoryPath } from "@/lib/slug";
import { validatePrices } from "@/lib/pricing";
import { extractPhoneFromWaLink } from "@/lib/whatsapp";

export interface CatalogRow {
  rowNumber: number;
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
  if (s.startsWith("=")) return "";
  return s;
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
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
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  }).map(normalizeRow);

  const rows: CatalogRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let whatsappNumber: string | null = null;
  const seenIds = new Set<string>();

  if (raw.length === 0) {
    errors.push({ row: 1, message: "The selected worksheet is empty" });
  } else {
    const headers = new Set(Object.keys(raw[0]));
    const requiredColumns = [
      { label: "id", aliases: ["id", "product_id", "item_id"] },
      { label: "title", aliases: ["title", "name", "product_name"] },
      { label: "price", aliases: ["price"] },
      { label: "image_link", aliases: ["image_link", "image_url"] },
    ];
    const missing = requiredColumns
      .filter((column) => !column.aliases.some((alias) => headers.has(alias)))
      .map((column) => column.label);
    if (missing.length > 0) {
      return {
        rows: [],
        errors: [
          {
            row: 1,
            message:
              `This is not a supported Meta catalogue Excel sheet. Missing required Meta columns: ${missing.join(", ")}.`,
          },
        ],
        whatsappNumber: null,
      };
    }
  }

  raw.forEach((row, index) => {
    const rowNum = index + 2;
    const id = cellStr(row.id || row.product_id || row.item_id);
    const title = cellStr(row.title || row.name || row.product_name);

    if (!id || !title) {
      errors.push({ row: rowNum, message: "Missing required id or title column/value" });
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
    let salePrice: number | null = saleRaw;

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

    const imageLink = cellStr(row.image_link || row.image_url);
    if (!imageLink || !imageLink.startsWith("http")) {
      errors.push({ row: rowNum, message: `Missing valid image_link for ${id}` });
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
  const fs = require("fs") as typeof import("fs");
  const buffer = fs.readFileSync(filePath);
  return parseExcelBuffer(buffer, department);
}
