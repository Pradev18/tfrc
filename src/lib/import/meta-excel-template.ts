import * as XLSX from "xlsx";

export const META_CATALOGUE_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "sale_price_effective_date",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "google_product_category",
  "fb_product_category",
  "quantity_to_sell_on_facebook",
  "size",
  "item_group_id",
  "gtin",
  "video_url",
  "video_tag",
  "product_tags",
] as const;

const EXAMPLE_ROW = [
  "NEW-1001",
  "Sample product name",
  "Short product description",
  "in stock",
  "new",
  "QAR 49.00",
  "",
  "",
  "",
  "https://example.com/product.jpg",
  "",
  "Your Brand",
  "",
  "",
  "10",
  "",
  "",
  "",
  "",
  "",
  "",
];

export function buildMetaCatalogueTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [...META_CATALOGUE_HEADERS],
    EXAMPLE_ROW,
  ]);
  sheet["!cols"] = META_CATALOGUE_HEADERS.map((header) => ({
    wch: Math.max(18, header.length + 4),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Meta Catalogue");
  return workbook;
}

export function downloadMetaCatalogueTemplate() {
  const workbook = buildMetaCatalogueTemplateWorkbook();
  XLSX.writeFile(workbook, "tfrc-meta-catalogue-template.xlsx");
}
