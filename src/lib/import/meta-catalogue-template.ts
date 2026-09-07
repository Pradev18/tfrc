import * as XLSX from "xlsx";

export const META_CATALOGUE_TEMPLATE_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "brand",
  "image_link",
  "additional_image_link",
  "google_product_category",
  "fb_product_category",
  "quantity_to_sell_on_facebook",
  "size",
  "item_group_id",
  "product_tags",
  "gtin",
  "link",
] as const;

export const PAWMART_TEMPLATE_ROWS: Array<Record<(typeof META_CATALOGUE_TEMPLATE_HEADERS)[number], string>> =
  [
    {
      id: "TFRC-PM-EXAMPLE-001",
      title: "Black Pet Hat (L)",
      description: "Soft black pet hat. Size Large. Replace this example row with your own product.",
      availability: "in stock",
      condition: "new",
      price: "QAR 45.00",
      sale_price: "QAR 39.00",
      brand: "PawMart",
      image_link: "https://example.com/pawmart/black-pet-hat-l.jpg",
      additional_image_link: "",
      google_product_category: "Animals & Pet Supplies > Pet Supplies > Pet Clothing",
      fb_product_category: "Pet Supplies > Clothing",
      quantity_to_sell_on_facebook: "10",
      size: "L",
      item_group_id: "TFRC-PM-HAT-BLACK",
      product_tags: "hats, apparel",
      gtin: "",
      link: "",
    },
    {
      id: "TFRC-PM-EXAMPLE-002",
      title: "Black Pet Hat (M)",
      description: "Soft black pet hat. Size Medium. Same product family as the Large hat.",
      availability: "in stock",
      condition: "new",
      price: "QAR 45.00",
      sale_price: "",
      brand: "PawMart",
      image_link: "https://example.com/pawmart/black-pet-hat-m.jpg",
      additional_image_link: "",
      google_product_category: "Animals & Pet Supplies > Pet Supplies > Pet Clothing",
      fb_product_category: "Pet Supplies > Clothing",
      quantity_to_sell_on_facebook: "8",
      size: "M",
      item_group_id: "TFRC-PM-HAT-BLACK",
      product_tags: "hats, apparel",
      gtin: "",
      link: "",
    },
    {
      id: "TFRC-PM-EXAMPLE-003",
      title: "Foldable Pet Carrier",
      description: "Lightweight foldable carrier for cats and small dogs. Replace with your product.",
      availability: "in stock",
      condition: "new",
      price: "QAR 120.00",
      sale_price: "",
      brand: "PawMart",
      image_link: "https://example.com/pawmart/foldable-pet-carrier.jpg",
      additional_image_link: "",
      google_product_category: "Animals & Pet Supplies > Pet Supplies > Pet Carriers",
      fb_product_category: "Pet Supplies > Carriers",
      quantity_to_sell_on_facebook: "5",
      size: "",
      item_group_id: "",
      product_tags: "carriers, travel",
      gtin: "",
      link: "",
    },
  ];

const EMPTY_EDIT_ROWS = 20;

const INSTRUCTIONS = [
  ["Edit this Excel and upload the same file"],
  [""],
  ["This file is a standard .xlsx spreadsheet. Open it in Microsoft Excel, Google Sheets, or LibreOffice."],
  ["Keep the first sheet named Meta Catalogue. Do not rename or delete the header row."],
  [""],
  ["Required columns you must fill for every product:"],
  ["id", "Unique product code. Do not reuse an ID from another catalogue."],
  ["title", "Product name, for example Black Pet Hat (L)"],
  ["price", "Write as QAR 45.00"],
  ["image_link", "Full https image URL"],
  [""],
  ["Optional but useful:"],
  ["sale_price", "Must be lower than price"],
  ["size", "L, M, S, XL"],
  ["item_group_id", "Same value for all sizes of one product"],
  ["brand", "Brand name"],
  ["description", "Short product description"],
  ["quantity_to_sell_on_facebook", "Stock quantity"],
  [""],
  ["How to use"],
  ["1. Rows 2-4 are PawMart examples. Replace those values or delete those rows."],
  ["2. Type new products in the empty rows already prepared below the examples."],
  ["3. Save the file as Excel Workbook (.xlsx). Do not export as PDF or CSV."],
  ["4. In admin, upload this same file, click Preview & validate, then Replace catalogue."],
];

function emptyTemplateRow(): Record<(typeof META_CATALOGUE_TEMPLATE_HEADERS)[number], string> {
  return Object.fromEntries(META_CATALOGUE_TEMPLATE_HEADERS.map((key) => [key, ""])) as Record<
    (typeof META_CATALOGUE_TEMPLATE_HEADERS)[number],
    string
  >;
}

export function buildMetaCatalogueTemplateBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ...PAWMART_TEMPLATE_ROWS,
    ...Array.from({ length: EMPTY_EDIT_ROWS }, emptyTemplateRow),
  ];
  const dataSheet = XLSX.utils.json_to_sheet(rows, {
    header: [...META_CATALOGUE_TEMPLATE_HEADERS],
  });
  dataSheet["!cols"] = META_CATALOGUE_TEMPLATE_HEADERS.map((header) => ({
    wch: Math.max(18, header.length + 6),
  }));
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Meta Catalogue");

  const instructionSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  instructionSheet["!cols"] = [{ wch: 36 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, "How to fill");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
