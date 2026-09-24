import { jsPDF } from "jspdf";
import type {
  CataloguePdfCategory,
  CataloguePdfPayload,
  CataloguePdfProduct,
} from "@/services/catalogue-pdf.service";

export const PDF_PRODUCTS_PER_PAGE = 12;
export const PDF_COLS = 4;
export const PDF_ROWS = 3;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 6;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const HEADER_HEIGHT = 17;
const CATEGORY_TOP = 25;
const CATEGORY_HEIGHT = 15;
const GRID_TOP = 43;
const GRID_BOTTOM = 278;
const GRID_HEIGHT = GRID_BOTTOM - GRID_TOP;
const GRID_GAP = 2;
const CARD_WIDTH = (CONTENT_WIDTH - GRID_GAP * (PDF_COLS - 1)) / PDF_COLS;
const CARD_HEIGHT = (GRID_HEIGHT - GRID_GAP * (PDF_ROWS - 1)) / PDF_ROWS;
const FOOTER_TOP = 281;

type Rgb = [number, number, number];

export interface CataloguePdfDocumentStats {
  pageCount: number;
  productPages: number;
  productCards: number;
  linkAnnotations: number;
  renderedImages: number;
  fallbackImages: number;
  renderedProductImages: number;
  fallbackProductImages: number;
  pageCardCounts: number[];
}

export interface CataloguePdfDocument {
  bytes: Uint8Array;
  stats: CataloguePdfDocumentStats;
}

interface LogicalProductPage {
  category: CataloguePdfCategory;
  products: CataloguePdfProduct[];
  categoryPageIndex: number;
  categoryPageCount: number;
  /** Y position (mm) of the category band on this physical page. */
  bandY: number;
  /** Y position (mm) of the first product-card row. */
  gridY: number;
}

interface PhysicalPageLayout {
  sections: LogicalProductPage[];
}

/** Small buffer against print/subpixel rounding — keep centralized. */
const SAFETY_BUFFER_MM = 1.5;
/** Gap between the bottom of one category's cards and the next category band. */
const SECTION_GAP_MM = 3;
/** Existing gap between category band bottom and first card row. */
const BAND_TO_GRID_GAP_MM = GRID_TOP - (CATEGORY_TOP + CATEGORY_HEIGHT);

export function chunkCatalogueProducts<T>(
  items: T[],
  size = PDF_PRODUCTS_PER_PAGE
): T[][] {
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function normalisePdfText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rgb(hex: string | null | undefined, fallback: Rgb): Rgb {
  const match = hex?.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(color: Rgb, whiteRatio: number): Rgb {
  return color.map((channel) =>
    Math.round(channel + (255 - channel) * whiteRatio)
  ) as Rgb;
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function ellipsiseLine(line: string, maxCharacters: number): string {
  if (line.length <= maxCharacters) return line;
  return `${line.slice(0, Math.max(1, maxCharacters - 3)).trimEnd()}...`;
}

function fittedLines(
  doc: jsPDF,
  value: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const text = normalisePdfText(value);
  if (!text) return [];
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  result[maxLines - 1] = ellipsiseLine(result[maxLines - 1]!, 60);
  return result;
}

function drawTextLines(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
  lineHeight: number
): number {
  const lines = fittedLines(doc, value, maxWidth, maxLines);
  if (lines.length) {
    doc.text(lines, x, y, { lineHeightFactor: 1 });
  }
  return y + Math.max(1, lines.length) * lineHeight;
}

function imageFormat(src: string): "PNG" | "JPEG" | "WEBP" | null {
  const match = src.match(/^data:image\/([^;,]+)/i);
  if (!match) return null;
  const type = match[1]!.toLowerCase();
  if (type === "png") return "PNG";
  if (type === "jpeg" || type === "jpg") return "JPEG";
  if (type === "webp") return "WEBP";
  return null;
}

function encodedImageDimensions(
  src: string,
  format: "PNG" | "JPEG" | "WEBP"
): { width: number; height: number } | null {
  const comma = src.indexOf(",");
  if (comma < 0 || !/;base64/i.test(src.slice(0, comma))) return null;

  try {
    const bytes = Buffer.from(src.slice(comma + 1), "base64");
    if (
      format === "PNG" &&
      bytes.length >= 24 &&
      bytes.subarray(1, 4).toString("ascii") === "PNG"
    ) {
      return {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      };
    }

    if (format === "JPEG" && bytes.length >= 10) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1]!;
        const isStartOfFrame =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isStartOfFrame) {
          return {
            height: bytes.readUInt16BE(offset + 5),
            width: bytes.readUInt16BE(offset + 7),
          };
        }
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const segmentLength = bytes.readUInt16BE(offset + 2);
        if (segmentLength < 2) break;
        offset += 2 + segmentLength;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function drawImageContained(
  doc: jsPDF,
  src: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  alias: string
): boolean {
  if (!src) return false;
  const format = imageFormat(src);
  if (!format) return false;

  try {
    let sourceWidth = width;
    let sourceHeight = height;
    try {
      const properties = doc.getImageProperties(src);
      sourceWidth = Number(properties.width) || width;
      sourceHeight = Number(properties.height) || height;
    } catch {
      // jsPDF cannot auto-detect some valid ICC/CMYK JPEGs even though
      // explicit JPEG embedding works. Read dimensions from the file header.
      const dimensions = encodedImageDimensions(src, format);
      sourceWidth = dimensions?.width || width;
      sourceHeight = dimensions?.height || height;
    }
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    doc.addImage(
      src,
      format,
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      alias,
      "FAST"
    );
    return true;
  } catch {
    return false;
  }
}

function drawImageFallback(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: Rgb
) {
  doc.setFillColor(...mix(accent, 0.92));
  doc.roundedRect(x, y, width, height, 1.6, 1.6, "F");
  doc.setDrawColor(...mix(accent, 0.72));
  doc.roundedRect(x + 1, y + 1, width - 2, height - 2, 1.2, 1.2, "S");
  const initials = normalisePdfText(label)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "TF";
  doc.setTextColor(...mix(accent, 0.25));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(initials, x + width / 2, y + height / 2 + 2, { align: "center" });
}

function drawTfrcMark(doc: jsPDF, x: number, y: number, scale = 1) {
  const purple: Rgb = [123, 45, 142];
  doc.setFillColor(...purple);
  for (let index = 0; index < 3; index += 1) {
    doc.roundedRect(x + index * 5.5 * scale, y, 3.5 * scale, 9 * scale, 0.5, 0.5, "F");
  }
  doc.setTextColor(...purple);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7 * scale);
  doc.text("TFRC", x + 7.3 * scale, y + 13 * scale, { align: "center" });
}

function drawCoverFeatureIcon(
  doc: jsPDF,
  kind: "quality" | "range" | "order" | "trust",
  centerX: number,
  centerY: number,
  color: Rgb
) {
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(0.55);

  if (kind === "quality") {
    doc.line(centerX - 2.2, centerY - 0.1, centerX - 0.5, centerY + 1.7);
    doc.line(centerX - 0.5, centerY + 1.7, centerX + 2.5, centerY - 2);
    return;
  }

  if (kind === "range") {
    const size = 1.45;
    const gap = 0.75;
    const startX = centerX - size - gap / 2;
    const startY = centerY - size - gap / 2;
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        doc.roundedRect(
          startX + column * (size + gap),
          startY + row * (size + gap),
          size,
          size,
          0.25,
          0.25,
          "F"
        );
      }
    }
    return;
  }

  if (kind === "order") {
    doc.line(centerX - 2.8, centerY - 2.1, centerX - 1.8, centerY - 2.1);
    doc.line(centerX - 1.8, centerY - 2.1, centerX - 1.1, centerY + 1.1);
    doc.line(centerX - 1.1, centerY + 1.1, centerX + 2.2, centerY + 1.1);
    doc.line(centerX - 1.5, centerY - 1.1, centerX + 2.7, centerY - 1.1);
    doc.line(centerX + 2.7, centerY - 1.1, centerX + 2.1, centerY + 0.5);
    doc.circle(centerX - 0.5, centerY + 2.2, 0.42, "F");
    doc.circle(centerX + 1.8, centerY + 2.2, 0.42, "F");
    return;
  }

  const points: Array<[number, number]> = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * (Math.PI / 5);
    const radius = index % 2 === 0 ? 2.8 : 1.25;
    points.push([
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    ]);
  }
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doc.line(current[0], current[1], next[0], next[1]);
  }
}

function drawPageFooter(
  doc: jsPDF,
  payload: CataloguePdfPayload,
  pageNumber: number,
  totalPages: number,
  colors: { cta: Rgb; muted: Rgb; line: Rgb }
) {
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.35);
  doc.line(PAGE_MARGIN, FOOTER_TOP, PAGE_WIDTH - PAGE_MARGIN, FOOTER_TOP);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.cta);
  doc.setFontSize(8);
  doc.text(normalisePdfText(payload.catalogue.name), PAGE_MARGIN, FOOTER_TOP + 4.3);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.setFontSize(6.2);
  doc.text("QUALITY PRODUCTS  |  WIDE RANGE  |  EASY ORDERING", PAGE_WIDTH / 2, FOOTER_TOP + 4.3, {
    align: "center",
  });
  doc.text(
    `WhatsApp ${normalisePdfText(payload.whatsappPhone)}`,
    PAGE_WIDTH - PAGE_MARGIN,
    FOOTER_TOP + 3.5,
    { align: "right" }
  );
  doc.setFont("helvetica", "bold");
  doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - PAGE_MARGIN, FOOTER_TOP + 7, {
    align: "right",
  });
}

function drawCoverQrPanel(
  doc: jsPDF,
  title: string,
  subtitle: string,
  qrDataUrl: string,
  href: string,
  x: number,
  y: number,
  width: number,
  colors: { cta: Rgb; muted: Rgb; line: Rgb },
  counters: { links: number; images: number; fallbacks: number }
) {
  const height = 36;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, "FD");

  const imageOk = drawImageContained(doc, qrDataUrl, x + 3, y + 3, 30, 30, `qr-${title}`);
  if (imageOk) counters.images += 1;
  else {
    drawImageFallback(doc, "QR", x + 3, y + 3, 30, 30, colors.cta);
    counters.fallbacks += 1;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.cta);
  doc.setFontSize(10);
  doc.text(normalisePdfText(title), x + 37, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.setFontSize(7.2);
  drawTextLines(doc, subtitle, x + 37, y + 16, width - 40, 2, 3.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.cta);
  doc.text("SCAN QR CODE", x + 37, y + 28);

  const url = safeExternalUrl(href);
  if (url) {
    doc.link(x, y, width, height, { url });
    counters.links += 1;
  }
}

function drawCover(
  doc: jsPDF,
  payload: CataloguePdfPayload,
  totalPages: number,
  colors: { accent: Rgb; cta: Rgb; heading: Rgb; muted: Rgb; line: Rgb },
  counters: { links: number; images: number; fallbacks: number }
) {
  doc.setFillColor(...mix(colors.accent, 0.93));
  doc.rect(0, 0, PAGE_WIDTH, 30, "F");
  drawTfrcMark(doc, PAGE_MARGIN + 1, 7, 1.05);

  if (
    !drawImageContained(
      doc,
      payload.catalogue.logoUrl,
      PAGE_WIDTH - PAGE_MARGIN - 38,
      6,
      38,
      18,
      "catalogue-logo"
    ) && payload.catalogue.logoUrl
  ) {
    counters.fallbacks += 1;
  } else if (payload.catalogue.logoUrl) {
    counters.images += 1;
  }

  doc.setTextColor(...colors.cta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const tagline = normalisePdfText(payload.catalogue.tagline || "Product catalogue by TFRC").toUpperCase();
  doc.text(tagline, PAGE_WIDTH / 2, 40, { align: "center", maxWidth: 174 });

  doc.setTextColor(...colors.heading);
  doc.setFontSize(29);
  const titleLines = fittedLines(doc, payload.catalogue.name, 180, 2);
  doc.text(titleLines, PAGE_WIDTH / 2, 54, { align: "center", lineHeightFactor: 1 });
  const titleBottom = 54 + (titleLines.length - 1) * 9;

  doc.setFillColor(...mix(colors.accent, 0.84));
  doc.roundedRect(75, titleBottom + 5, 60, 9, 4.5, 4.5, "F");
  doc.setTextColor(...colors.cta);
  doc.setFontSize(11);
  doc.text("PRODUCT BROCHURE", PAGE_WIDTH / 2, titleBottom + 11.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.setFontSize(9);
  const description = normalisePdfText(
    payload.catalogue.description ||
      `Browse ${payload.catalogue.name} by category and order on WhatsApp with TFRC.`
  );
  doc.text(fittedLines(doc, description, 170, 2), PAGE_WIDTH / 2, titleBottom + 22, {
    align: "center",
    lineHeightFactor: 1.2,
  });

  const featureY = titleBottom + 37;
  const features = [
    ["QUALITY & SAFE", "quality"],
    ["WIDE PRODUCT RANGE", "range"],
    ["EASY ORDERING", "order"],
    ["TRUSTED BY TFRC", "trust"],
  ] as const;
  features.forEach(([feature, icon], index) => {
    const x = PAGE_MARGIN + index * (CONTENT_WIDTH / 4);
    doc.setFillColor(...mix(colors.accent, 0.9));
    doc.circle(x + CONTENT_WIDTH / 8, featureY, 4, "F");
    drawCoverFeatureIcon(
      doc,
      icon,
      x + CONTENT_WIDTH / 8,
      featureY,
      colors.cta
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.cta);
    doc.setFontSize(6.5);
    doc.text(feature, x + CONTENT_WIDTH / 8, featureY + 8, { align: "center" });
  });

  const statY = featureY + 15;
  const statWidth = 55;
  [
    ["PRODUCTS", String(payload.totalProducts)],
    ["CARDS", String(payload.listedCards)],
    ["CATEGORIES", String(payload.categories.length)],
  ].forEach(([label, value], index) => {
    const x = 19 + index * (statWidth + 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(x, statY, statWidth, 20, 2.5, 2.5, "FD");
    doc.setTextColor(...colors.muted);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(label!, x + statWidth / 2, statY + 6, { align: "center" });
    doc.setTextColor(...colors.heading);
    doc.setFontSize(17);
    doc.text(value!, x + statWidth / 2, statY + 15.5, { align: "center" });
  });

  const tocY = statY + 26;
  doc.setTextColor(...colors.cta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CATEGORIES", PAGE_MARGIN, tocY);

  const categories = payload.categories.filter((category) => category.products.length > 0);
  const tocRows = Math.max(1, Math.min(10, Math.ceil(categories.length / 2)));
  const tocColumns = Math.max(2, Math.ceil(categories.length / tocRows));
  const availableTocHeight = 49;
  const tocGap = tocColumns > 4 ? 1.5 : 4;
  const tocRowHeight = Math.min(8, availableTocHeight / tocRows);
  const tocWidth = (CONTENT_WIDTH - tocGap * (tocColumns - 1)) / tocColumns;
  categories.forEach((category, index) => {
    const column = Math.floor(index / tocRows);
    const row = index % tocRows;
    const x = PAGE_MARGIN + column * (tocWidth + tocGap);
    const y = tocY + 4 + row * tocRowHeight;
    doc.setFillColor(...mix(colors.accent, 0.93));
    doc.roundedRect(x, y, tocWidth, Math.max(3.8, tocRowHeight - 0.7), 1.2, 1.2, "F");
    doc.setTextColor(...colors.cta);
    doc.setFontSize(Math.max(4.2, Math.min(7.4, tocRowHeight - 1.2)));
    doc.setFont("helvetica", "bold");
    const name = ellipsiseLine(
      normalisePdfText(category.name),
      Math.max(8, Math.floor(tocWidth / 1.9))
    );
    const baseline = y + Math.max(3, tocRowHeight - 2.8);
    doc.text(`${index + 1}. ${name}`, x + 1.5, baseline);
    doc.text(String(category.productCount), x + tocWidth - 1.5, baseline, {
      align: "right",
    });
  });

  const qrY = 238;
  const qrWidth = (CONTENT_WIDTH - 4) / 2;
  drawCoverQrPanel(
    doc,
    "Visit Our Website",
    "Explore the full catalogue",
    payload.websiteQrDataUrl,
    payload.websiteUrl,
    PAGE_MARGIN,
    qrY,
    qrWidth,
    colors,
    counters
  );
  drawCoverQrPanel(
    doc,
    "WhatsApp Orders",
    "Quick and easy ordering",
    payload.whatsappQrDataUrl,
    payload.whatsappUrl,
    PAGE_MARGIN + qrWidth + 4,
    qrY,
    qrWidth,
    colors,
    counters
  );

  drawPageFooter(doc, payload, 1, totalPages, colors);
}

function drawHeader(
  doc: jsPDF,
  payload: CataloguePdfPayload,
  colors: { accent: Rgb; cta: Rgb; muted: Rgb; line: Rgb },
  counters: { images: number; fallbacks: number }
) {
  doc.setFillColor(...mix(colors.accent, 0.94));
  doc.rect(0, 0, PAGE_WIDTH, 23, "F");
  drawTfrcMark(doc, PAGE_MARGIN, 4, 0.75);

  doc.setTextColor(...colors.cta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    ellipsiseLine(normalisePdfText(payload.catalogue.name), 45),
    31,
    10
  );
  doc.setTextColor(...colors.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    ellipsiseLine(
      normalisePdfText(payload.catalogue.tagline || "Product catalogue by TFRC"),
      75
    ),
    31,
    15
  );

  if (payload.catalogue.logoUrl) {
    if (
      drawImageContained(
        doc,
        payload.catalogue.logoUrl,
        PAGE_WIDTH - PAGE_MARGIN - 31,
        3,
        31,
        HEADER_HEIGHT - 2,
        "catalogue-logo"
      )
    ) counters.images += 1;
    else counters.fallbacks += 1;
  }

  doc.setDrawColor(...colors.line);
  doc.line(PAGE_MARGIN, 22.5, PAGE_WIDTH - PAGE_MARGIN, 22.5);
}

function drawCategoryBand(
  doc: jsPDF,
  page: LogicalProductPage,
  colors: { accent: Rgb; cta: Rgb; muted: Rgb },
  bandY = CATEGORY_TOP
) {
  doc.setFillColor(...mix(colors.accent, 0.93));
  doc.roundedRect(PAGE_MARGIN, bandY, CONTENT_WIDTH, CATEGORY_HEIGHT, 2, 2, "F");
  doc.setTextColor(...colors.cta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    ellipsiseLine(normalisePdfText(page.category.name), 52),
    PAGE_MARGIN + 3,
    bandY + 6
  );
  doc.setTextColor(...colors.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    `${page.category.productCount} items | ${page.category.products.length} cards | ${page.products.length} on this page`,
    PAGE_MARGIN + 3,
    bandY + 11
  );
  doc.setFillColor(...colors.cta);
  doc.roundedRect(PAGE_WIDTH - PAGE_MARGIN - 28, bandY + 3.3, 25, 8, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    `${page.categoryPageIndex + 1} / ${page.categoryPageCount}`,
    PAGE_WIDTH - PAGE_MARGIN - 15.5,
    bandY + 8.6,
    { align: "center" }
  );
}

function drawProductCard(
  doc: jsPDF,
  product: CataloguePdfProduct,
  x: number,
  y: number,
  colors: { accent: Rgb; cta: Rgb; heading: Rgb; muted: Rgb; line: Rgb },
  counters: {
    links: number;
    images: number;
    fallbacks: number;
    productImages: number;
    productFallbacks: number;
  }
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.28);
  doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 2, 2, "FD");

  const imageX = x + 1.5;
  const imageY = y + 1.5;
  const imageWidth = CARD_WIDTH - 3;
  const imageHeight = 34;
  doc.setFillColor(...mix(colors.accent, 0.95));
  doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 1.4, 1.4, "F");
  if (
    drawImageContained(
      doc,
      product.imageUrl,
      imageX + 1,
      imageY + 1,
      imageWidth - 2,
      imageHeight - 2,
      `product-${product.id}`
    )
  ) {
    counters.images += 1;
    counters.productImages += 1;
  }
  else {
    drawImageFallback(
      doc,
      product.displayName,
      imageX + 1,
      imageY + 1,
      imageWidth - 2,
      imageHeight - 2,
      colors.accent
    );
    counters.fallbacks += 1;
    counters.productFallbacks += 1;
  }

  const bodyX = x + 2;
  const bodyWidth = CARD_WIDTH - 4;
  let cursorY = imageY + imageHeight + 4;
  doc.setTextColor(...colors.cta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  cursorY = drawTextLines(
    doc,
    product.displayName,
    bodyX,
    cursorY,
    bodyWidth,
    2,
    3.4
  );

  doc.setTextColor(...colors.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.1);
  doc.text(
    ellipsiseLine(`Item code: ${normalisePdfText(product.productId)}`, 38),
    bodyX,
    cursorY + 0.8
  );
  cursorY += 4;

  if (product.availableSizes.length > 0) {
    const sizes = ellipsiseLine(
      `Sizes: ${product.availableSizes.map(normalisePdfText).join(", ")}`,
      44
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...colors.cta);
    doc.text(sizes, bodyX, cursorY);
  }

  const buttonHeight = 6.5;
  const buttonY = y + CARD_HEIGHT - buttonHeight - 1.7;
  const stockY = buttonY - 3.2;
  const priceY = stockY - 4.2;

  doc.setTextColor(...colors.heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const price = `${product.priceFrom ? "From " : ""}${normalisePdfText(
    product.currency
  )} ${product.price.toFixed(2)}`;
  doc.text(ellipsiseLine(price, 30), bodyX, priceY);

  doc.setTextColor(...(product.inStock ? ([22, 101, 52] as Rgb) : ([159, 18, 57] as Rgb)));
  doc.setFontSize(6.3);
  doc.text(product.inStock ? "In stock" : "Check availability", bodyX, stockY);

  const whatsappUrl = safeExternalUrl(product.whatsappUrl);
  doc.setFillColor(...(whatsappUrl ? ([18, 140, 71] as Rgb) : ([107, 114, 128] as Rgb)));
  doc.roundedRect(bodyX, buttonY, bodyWidth, buttonHeight, 1.2, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("WhatsApp Order", x + CARD_WIDTH / 2, buttonY + 4.35, { align: "center" });
  if (whatsappUrl) {
    doc.link(bodyX, buttonY, bodyWidth, buttonHeight, { url: whatsappUrl });
    counters.links += 1;
  }
}

function chunkIntoRows<T>(items: T[], cols = PDF_COLS): T[][] {
  if (items.length === 0) return [];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += cols) {
    rows.push(items.slice(index, index + cols));
  }
  return rows;
}

/**
 * How many complete product rows fit when the first row starts at gridY.
 * Uses exact A4 card geometry so a fresh page still holds the normal 3×4 = 12 cards.
 */
function maxRowsFromGridY(gridY: number): number {
  let rows = 0;
  while (rows < PDF_ROWS * 4) {
    const nextEnd = endYAfterRows(gridY, rows + 1);
    if (nextEnd > GRID_BOTTOM + 0.01) break;
    rows += 1;
  }
  return rows;
}

function endYAfterRows(gridY: number, rowCount: number): number {
  if (rowCount <= 0) return gridY;
  return gridY + rowCount * CARD_HEIGHT + (rowCount - 1) * GRID_GAP;
}

/**
 * Can the next category's header + first complete product row start after cursorY?
 * Uses real A4 geometry (mm), not arbitrary card-count heuristics.
 */
function tryPlaceCategoryStart(cursorY: number): {
  bandY: number;
  gridY: number;
  maxRows: number;
} | null {
  const bandY = cursorY + SECTION_GAP_MM;
  // Category band must stay above the footer zone.
  if (bandY + CATEGORY_HEIGHT > GRID_BOTTOM - SAFETY_BUFFER_MM) return null;
  const gridY = bandY + CATEGORY_HEIGHT + BAND_TO_GRID_GAP_MM;
  const maxRows = maxRowsFromGridY(gridY);
  // Atomic rule: header + first row must both fit (with a small safety buffer).
  if (maxRows < 1) return null;
  if (endYAfterRows(gridY, 1) > GRID_BOTTOM - SAFETY_BUFFER_MM) return null;
  return { bandY, gridY, maxRows };
}

/**
 * Pack categories onto physical A4 pages.
 * - Preserves category order and product order
 * - Never orphans a category header without its first row
 * - Never splits a 4-card row across pages
 * - Reuses leftover vertical space for the next category when safe
 * - Continues a long category onto the next page without moving earlier rows
 */
export function packCataloguePhysicalPages(
  payload: CataloguePdfPayload
): PhysicalPageLayout[] {
  const pages: PhysicalPageLayout[] = [];
  let current: PhysicalPageLayout | null = null;
  /** Bottom Y of the last placed card row on the current page (mm). */
  let cursorY: number | null = null;

  for (const category of payload.categories) {
    if (category.products.length === 0) continue;
    const remainingRows = chunkIntoRows(category.products);

    while (remainingRows.length > 0) {
      let bandY: number;
      let gridY: number;
      let maxRows: number;

      if (!current || cursorY == null) {
        current = { sections: [] };
        pages.push(current);
        bandY = CATEGORY_TOP;
        gridY = GRID_TOP;
        maxRows = maxRowsFromGridY(gridY);
      } else {
        const fit = tryPlaceCategoryStart(cursorY);
        if (!fit) {
          current = null;
          cursorY = null;
          continue;
        }
        bandY = fit.bandY;
        gridY = fit.gridY;
        maxRows = fit.maxRows;
      }

      if (maxRows < 1) {
        current = null;
        cursorY = null;
        continue;
      }

      const takenRows = remainingRows.splice(0, maxRows);
      const products = takenRows.flat();
      current.sections.push({
        category,
        products,
        categoryPageIndex: 0,
        categoryPageCount: 1,
        bandY,
        gridY,
      });
      cursorY = endYAfterRows(gridY, takenRows.length);

      // More rows remain → finish this physical page and continue on the next.
      if (remainingRows.length > 0) {
        current = null;
        cursorY = null;
      }
    }
  }

  // Assign per-category page indices (1/N style) without changing order.
  const bySlug = new Map<string, LogicalProductPage[]>();
  for (const page of pages) {
    for (const section of page.sections) {
      const list = bySlug.get(section.category.slug) ?? [];
      list.push(section);
      bySlug.set(section.category.slug, list);
    }
  }
  for (const sections of bySlug.values()) {
    sections.forEach((section, index) => {
      section.categoryPageIndex = index;
      section.categoryPageCount = sections.length;
    });
  }

  return pages;
}

export function buildCataloguePdfDocument(
  payload: CataloguePdfPayload
): CataloguePdfDocument {
  const physicalPages = packCataloguePhysicalPages(payload);
  const totalPages = 1 + physicalPages.length;
  const colors = {
    accent: rgb(payload.accent, [64, 145, 108]),
    cta: rgb(payload.cta, [27, 67, 50]),
    heading: rgb(payload.heading, [20, 20, 20]),
    muted: rgb(payload.muted, [107, 101, 96]),
    line: [211, 226, 218] as Rgb,
  };
  const counters = {
    links: 0,
    images: 0,
    fallbacks: 0,
    productImages: 0,
    productFallbacks: 0,
  };

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    hotfixes: ["px_scaling"],
  });
  doc.setProperties({
    title: `${normalisePdfText(payload.catalogue.name)} Product Brochure`,
    subject: "TFRC catalogue product brochure",
    author: "TFRC",
    creator: "TFRC Catalogue PDF Renderer",
    keywords: `TFRC, catalogue, ${normalisePdfText(payload.catalogue.name)}`,
  });

  drawCover(doc, payload, totalPages, colors, counters);

  physicalPages.forEach((page, pageIndex) => {
    doc.addPage("a4", "portrait");
    drawHeader(doc, payload, colors, counters);

    for (const section of page.sections) {
      drawCategoryBand(doc, section, colors, section.bandY);

      section.products.forEach((product, cardIndex) => {
        const column = cardIndex % PDF_COLS;
        const row = Math.floor(cardIndex / PDF_COLS);
        drawProductCard(
          doc,
          product,
          PAGE_MARGIN + column * (CARD_WIDTH + GRID_GAP),
          section.gridY + row * (CARD_HEIGHT + GRID_GAP),
          colors,
          counters
        );
      });
    }

    drawPageFooter(doc, payload, pageIndex + 2, totalPages, colors);
  });

  const allSections = physicalPages.flatMap((page) => page.sections);
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return {
    bytes,
    stats: {
      pageCount: totalPages,
      productPages: physicalPages.length,
      productCards: allSections.reduce((sum, section) => sum + section.products.length, 0),
      linkAnnotations: counters.links,
      renderedImages: counters.images,
      fallbackImages: counters.fallbacks,
      renderedProductImages: counters.productImages,
      fallbackProductImages: counters.productFallbacks,
      pageCardCounts: physicalPages.map((page) =>
        page.sections.reduce((sum, section) => sum + section.products.length, 0)
      ),
    },
  };
}
