import * as XLSX from "xlsx";
import { parsePriceString } from "@/lib/utils";
import { createProductSlug, createCategorySlug, parseCategoryPath } from "@/lib/slug";
import { validatePrices } from "@/lib/pricing";
import { extractPhoneFromWaLink } from "@/lib/whatsapp";

export interface CatalogRow {
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
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows: CatalogRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let whatsappNumber: string | null = null;

  raw.forEach((row, index) => {
    const rowNum = index + 2;
    const id = cellStr(row.id);
    const title = cellStr(row.title);

    if (!id || !title) {
      if (id || title) {
        errors.push({ row: rowNum, message: "Missing required id or title" });
      }
      return;
    }

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
      salePrice = null;
    }

    const link = cellStr(row.link);
    if (link && !whatsappNumber) {
      whatsappNumber = extractPhoneFromWaLink(link);
    }

    const imageLink = cellStr(row.image_link);
    if (!imageLink || !imageLink.startsWith("http")) {
      errors.push({ row: rowNum, message: `Missing valid image_link for ${id}` });
      return;
    }

    rows.push({
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
        parseInt(cellStr(row.quantity_to_sell_on_facebook), 10) || null,
      sale_price_effective_date: cellStr(row.sale_price_effective_date) || null,
      video_url: cellStr(row["video[0].url"]) || null,
      video_tag: cellStr(row["video[0].tag[0]"]) || null,
      gtin: cellStr(row.gtin) || null,
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
