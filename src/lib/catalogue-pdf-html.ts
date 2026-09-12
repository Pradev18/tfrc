import type { CataloguePdfPayload, CataloguePdfProduct } from "@/services/catalogue-pdf.service";

export const PDF_PRODUCTS_PER_PAGE = 9;
export const PDF_COLS = 3;
export const PDF_ROWS = 3;

export function chunkProducts<T>(items: T[], size = PDF_PRODUCTS_PER_PAGE): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export function formatPdfPrice(amount: number, currency = "QAR"): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function tfrcMarkSvg() {
  return `<svg class="brand-logo brand-logo--tfrc" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="0" width="8" height="24" rx="1" fill="#7B2D8E"/>
    <rect x="14" y="0" width="8" height="24" rx="1" fill="#7B2D8E"/>
    <rect x="28" y="0" width="8" height="24" rx="1" fill="#7B2D8E"/>
  </svg>`;
}

function brandBlock(catalogue: CataloguePdfPayload["catalogue"], accent: string, large = false) {
  const logo = catalogue.logoUrl
    ? `<img class="brand-logo${large ? " brand-logo--lg" : ""}" src="${escapeAttr(catalogue.logoUrl)}" alt="${escapeAttr(catalogue.name)}" />`
    : tfrcMarkSvg();

  return `
    <div class="brand-row${large ? " brand-row--lg" : ""}">
      ${logo}
      <div class="brand-copy">
        <p class="brand-name">${escapeHtml(catalogue.name)}</p>
        <p class="brand-sub">${escapeHtml(catalogue.tagline || "TFRC catalogue")}</p>
        <p class="brand-by">by TFRC</p>
      </div>
    </div>`;
}

function sizeChips(product: CataloguePdfProduct): string {
  if (!product.availableSizes.length) return "";
  const chips = product.availableSizes
    .map((size) => `<span class="size-chip">${escapeHtml(size)}</span>`)
    .join("");
  return `
    <div class="sizes">
      <p class="sizes-label">Available sizes</p>
      <div class="size-row">${chips}</div>
    </div>`;
}

function productCard(product: CataloguePdfProduct): string {
  const priceLabel = `${product.priceFrom ? "From " : ""}${formatPdfPrice(product.price, product.currency)}`;
  return `
    <article class="card">
      <div class="card-image">
        <img src="${escapeAttr(product.imageUrl || "")}" alt="${escapeAttr(product.displayName)}" />
      </div>
      <div class="card-body">
        <h3>${escapeHtml(product.displayName)}</h3>
        <p class="meta">Item code ${escapeHtml(product.productId)}</p>
        ${sizeChips(product)}
        <div class="card-foot">
          <div class="card-price-block">
            <p class="price">${escapeHtml(priceLabel)}</p>
            <p class="stock ${product.inStock ? "in" : "out"}">${
              product.inStock ? "In stock" : "Check availability"
            }</p>
          </div>
          <span class="wa-label">WhatsApp order</span>
        </div>
      </div>
    </article>`;
}

export function buildCataloguePdfHtml(
  payload: CataloguePdfPayload,
  options?: { autoPrint?: boolean }
) {
  const {
    catalogue,
    categories,
    totalProducts,
    listedCards,
    accent,
    heading,
    muted,
    surface,
    generatedAt,
    whatsappUrl,
  } = payload;
  const dateLabel = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const phone = whatsappUrl.replace(/^https?:\/\/wa\.me\//, "").split("?")[0] || "TFRC";

  const coverLinks = categories
    .map(
      (cat, index) => `
      <div class="toc-row">
        <span class="toc-num">${index + 1}</span>
        <span class="toc-name">${escapeHtml(cat.name)}</span>
        <span class="toc-count">${cat.productCount}</span>
      </div>`
    )
    .join("");

  const categoryPages = categories
    .map((cat) => {
      const pages = chunkProducts(cat.products, PDF_PRODUCTS_PER_PAGE);
      return pages
        .map((pageProducts, pageIndex) => {
          const isFirst = pageIndex === 0;
          const continued = !isFirst;
          const cards = pageProducts.map(productCard).join("");

          return `
          <section class="sheet category-sheet" ${
            isFirst ? `id="category-${escapeHtml(cat.slug)}"` : ""
          }>
            <header class="sheet-header">
              ${brandBlock(catalogue, accent)}
              <div class="page-meta">
                <p class="page-cat">${escapeHtml(cat.name)}</p>
                <p class="page-num">Page ${pageIndex + 1} / ${pages.length}</p>
              </div>
            </header>

            <div class="title-block">
              <h1>${escapeHtml(cat.name)}${continued ? ' <span>continued</span>' : ""}</h1>
              <p>${cat.productCount} catalogue items · ${cat.products.length} cards · ${pageProducts.length} on this page</p>
            </div>

            <div class="grid">
              ${cards}
            </div>

            <footer class="sheet-footer">
              <span>${escapeHtml(catalogue.name)} · TFRC</span>
              <span>${dateLabel}</span>
            </footer>
          </section>`;
        })
        .join("");
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(catalogue.name)} Catalogue Brochure</title>
  <style>
    :root {
      --accent: ${escapeAttr(accent)};
      --heading: ${escapeAttr(heading)};
      --muted: ${escapeAttr(muted)};
      --surface: ${escapeAttr(surface)};
      --line: #e6ebe8;
      --soft: #f5f8f6;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--heading);
      background: #e8eee9;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: rgba(255,255,255,0.98);
      border-bottom: 1px solid var(--line);
    }
    .toolbar p { margin: 0; font-size: 13px; color: var(--muted); }
    .toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
    }
    .sheet {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 16px auto;
      padding: 7mm 7.5mm 6.5mm;
      background: #fff;
      box-shadow: 0 16px 40px rgba(15, 41, 34, 0.1);
      border-radius: 6px;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 6px;
      background: var(--accent);
    }
    .brand-row {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
    }
    .brand-row--lg { gap: 14px; }
    .brand-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 3px;
      flex-shrink: 0;
    }
    .brand-logo--lg {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      padding: 6px;
    }
    .brand-logo--tfrc {
      padding: 10px 8px;
    }
    .brand-name {
      margin: 0;
      font-weight: 800;
      font-size: 16px;
      line-height: 1.15;
    }
    .brand-row--lg .brand-name { font-size: 22px; }
    .brand-sub {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted);
    }
    .brand-by {
      margin: 2px 0 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #7B2D8E;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 5px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--line);
      flex-shrink: 0;
    }
    .page-meta { text-align: right; }
    .page-cat {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
    }
    .page-num {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted);
    }
    .title-block { margin-bottom: 5px; flex-shrink: 0; }
    .title-block h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: -0.02em;
      line-height: 1.15;
      font-weight: 800;
    }
    .title-block h1 span {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
    }
    .title-block p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 11px;
    }
    /* Fixed 3×3 — cards fill cells so all 9 stay inside A4 (no clipped empty row). */
    .grid {
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 5px;
      align-content: stretch;
      min-height: 0;
      overflow: hidden;
    }
    .card {
      border: 1px solid #dce5e0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      max-height: 100%;
      box-shadow: 0 1px 4px rgba(20, 40, 30, 0.04);
    }
    .card-image {
      flex: 0 0 46%;
      width: 100%;
      min-height: 0;
      max-height: 46%;
      padding: 4px;
      background: linear-gradient(180deg, #f7faf8 0%, #eef4f0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #e5eee9;
      overflow: hidden;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      background: #fff;
      border-radius: 6px;
      display: block;
      border: 1px solid #eef3ef;
    }
    .card-body {
      padding: 5px 6px 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 0;
      flex: 1 1 auto;
      overflow: hidden;
    }
    .card-body h3 {
      margin: 0;
      font-size: 10.5px;
      line-height: 1.25;
      font-weight: 700;
      max-height: 2.5em;
      overflow: hidden;
      color: #141414;
    }
    .meta {
      margin: 0;
      font-size: 9px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sizes {
      margin-top: 0;
      padding: 3px 4px;
      border-radius: 6px;
      background: #f3f7f4;
      border: 1px solid #e0ebe4;
      flex-shrink: 0;
      max-height: 28px;
      overflow: hidden;
    }
    .sizes-label {
      margin: 0 0 2px;
      font-size: 7px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .size-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      max-height: 16px;
      overflow: hidden;
    }
    .size-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 5px;
      border: 1px solid #cfe0d6;
      background: #fff;
      color: #14352a;
      font-size: 8px;
      font-weight: 800;
      line-height: 1;
      padding: 2px 4px;
      white-space: nowrap;
    }
    .card-foot {
      margin-top: auto;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 4px;
      padding-top: 3px;
      border-top: 1px solid #eef2ef;
      flex-shrink: 0;
    }
    .card-price-block { min-width: 0; }
    .price {
      margin: 0;
      font-size: 11px;
      font-weight: 800;
      color: var(--accent);
      letter-spacing: -0.01em;
    }
    .stock {
      margin: 1px 0 0;
      font-size: 7.5px;
      font-weight: 700;
    }
    .stock.in { color: #166534; }
    .stock.out { color: #9f1239; }
    .wa-label {
      margin: 0;
      display: inline-block;
      text-align: center;
      border-radius: 999px;
      background: #128c47;
      color: #fff;
      font-size: 7.5px;
      font-weight: 800;
      padding: 4px 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid var(--line);
      font-size: 9px;
      color: var(--muted);
      flex-shrink: 0;
    }
    .cover {
      background: linear-gradient(165deg, #ffffff 0%, var(--surface) 55%, #fff 100%);
    }
    .cover-hero h1 {
      margin: 16px 0 8px;
      font-size: 32px;
      line-height: 1.05;
      letter-spacing: -0.03em;
      font-weight: 800;
    }
    .cover-hero p.lead { margin: 0; color: var(--muted); font-size: 13px; max-width: 460px; }
    .stats {
      display: flex;
      gap: 10px;
      margin: 18px 0 16px;
    }
    .stat {
      flex: 1;
      border-radius: 14px;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: 0 1px 0 rgba(20,20,20,0.03);
    }
    .stat strong { display: block; font-size: 22px; margin-top: 4px; font-weight: 800; }
    .stat span {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    .toc-title { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
    .toc-note { margin: 0 0 10px; color: var(--muted); font-size: 12px; }
    .variant-note {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .variant-note strong { color: var(--ink); font-weight: 700; }
    .toc-row {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 9px 11px;
      margin-bottom: 6px;
      border-radius: 12px;
      background: #fff;
      border: 1px solid var(--line);
    }
    .toc-num {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 12px;
      color: #fff;
      background: var(--accent);
    }
    .toc-name { font-weight: 700; font-size: 13px; }
    .toc-count { color: var(--muted); font-size: 12px; font-weight: 600; }
    .wa-cover {
      display: inline-block;
      margin-top: 14px;
      border-radius: 999px;
      background: #128c47;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 10px 16px;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet {
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
      }
      .grid {
        grid-template-rows: repeat(3, minmax(0, 1fr));
      }
      .card {
        height: 100%;
        max-height: 100%;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .category-sheet, .cover {
        page-break-after: always;
        break-after: page;
      }
      .category-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="toolbar">
    <p>${escapeHtml(catalogue.name)} brochure · ${totalProducts} catalogue items · ${listedCards} cards · ${categories.length} categories · TFRC</p>
    <button type="button" onclick="window.print()">Download / Print PDF</button>
  </div>

  <section class="sheet cover" id="toc">
    <div class="cover-hero">
      ${brandBlock(catalogue, accent, true)}
      <h1>${escapeHtml(catalogue.name)} Product Brochure</h1>
      <p class="lead">Print-ready A4 booklet with category pages, product cards, and available sizes clearly listed for customers.</p>
      <div class="wa-cover">WhatsApp orders · ${escapeHtml(phone)}</div>
      <div class="stats">
        <div class="stat"><span>Products</span><strong>${totalProducts}</strong></div>
        <div class="stat"><span>Categories</span><strong>${categories.length}</strong></div>
        <div class="stat"><span>Generated</span><strong style="font-size:15px">${escapeHtml(dateLabel)}</strong></div>
      </div>
      <p class="variant-note">
        <strong>Note:</strong> The Products count matches your Excel / catalogue import (${totalProducts} items).
        Same product in different sizes may not appear as separate cards — those rows are grouped into one card with sizes listed (${listedCards} cards in this brochure).
      </p>
    </div>
    <h2 class="toc-title">Categories</h2>
    <p class="toc-note">Index for the printed brochure — category counts match Excel items; size variants are shown on each card.</p>
    ${coverLinks || "<p>No products found.</p>"}
  </section>

  ${categoryPages}
  <script>
    ${
      options?.autoPrint
        ? "window.addEventListener('load', () => setTimeout(() => window.print(), 250));"
        : ""
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
