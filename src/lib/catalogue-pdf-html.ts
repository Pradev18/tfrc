import type { CataloguePdfPayload } from "@/services/catalogue-pdf.service";

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

function brandBlock(catalogue: CataloguePdfPayload["catalogue"], accent: string) {
  const logo = catalogue.logoUrl
    ? `<img class="brand-logo" src="${escapeAttr(catalogue.logoUrl)}" alt="" />`
    : `<div class="brand-mark" style="background:${escapeAttr(accent)};color:#fff">${escapeHtml(
        (catalogue.name.charAt(0) || "C").toUpperCase()
      )}</div>`;

  return `
    <div class="brand-row">
      ${logo}
      <div>
        <p class="brand-name">${escapeHtml(catalogue.name)}</p>
        <p class="brand-sub">${escapeHtml(catalogue.tagline || "Product catalogue")}</p>
      </div>
    </div>`;
}

export function buildCataloguePdfHtml(
  payload: CataloguePdfPayload,
  options?: { autoPrint?: boolean }
) {
  const {
    catalogue,
    categories,
    totalProducts,
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
          const cards = pageProducts
            .map(
              (product) => `
            <article class="card">
              <div class="card-image">
                <img src="${escapeAttr(product.imageUrl || "")}" alt="${escapeAttr(product.name)}" />
              </div>
              <div class="card-body">
                <h3>${escapeHtml(product.name)}</h3>
                <p class="meta">ID ${escapeHtml(product.productId)}${
                  product.size ? ` · ${escapeHtml(product.size)}` : ""
                }</p>
                <p class="price">${escapeHtml(formatPdfPrice(product.price, product.currency))}</p>
                <p class="stock ${product.inStock ? "in" : "out"}">${
                  product.inStock ? "In Stock" : "Check availability"
                }</p>
                <p class="wa-label">Order on WhatsApp</p>
              </div>
            </article>`
            )
            .join("");

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
              <h1>${escapeHtml(cat.name)}${continued ? " <span>continued</span>" : ""}</h1>
              <p>${cat.productCount} products in this category · ${pageProducts.length} on this page</p>
            </div>

            <div class="grid">
              ${cards}
            </div>

            <footer class="sheet-footer">
              <span>${escapeHtml(catalogue.name)} brochure</span>
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
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--heading);
      background: #dfe8e2;
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
      background: rgba(255,255,255,0.97);
      border-bottom: 1px solid #d5e3da;
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
      margin: 16px auto;
      padding: 10mm 10mm 9mm;
      background: #fff;
      box-shadow: 0 18px 50px rgba(15, 41, 34, 0.12);
      border-radius: 4px;
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
      height: 5px;
      background: var(--accent);
    }
    .brand-row {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
    }
    .brand-logo {
      width: 42px;
      height: 42px;
      object-fit: contain;
      background: #fff;
      border: 1px solid #e5eee8;
      border-radius: 10px;
      padding: 3px;
      flex-shrink: 0;
    }
    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 18px;
      flex-shrink: 0;
    }
    .brand-name {
      margin: 0;
      font-weight: 800;
      font-size: 15px;
      line-height: 1.15;
    }
    .brand-sub {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted);
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e7eee9;
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
    .title-block { margin-bottom: 8px; }
    .title-block h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .title-block h1 span {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
    }
    .title-block p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 11px;
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: 1fr;
      gap: 7px;
      align-content: start;
      min-height: 0;
    }
    .card {
      border: 1px solid #dfe8e3;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 78mm;
    }
    .card-image {
      height: 42mm;
      width: 100%;
      padding: 5px;
      background: #f7faf8;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #eef3ef;
      flex-shrink: 0;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      background: #fff;
      display: block;
    }
    .card-body {
      padding: 6px 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 0;
      flex: 1;
    }
    .card-body h3 {
      margin: 0;
      font-size: 11px;
      line-height: 1.25;
      height: 2.5em;
      overflow: hidden;
    }
    .meta {
      margin: 0;
      font-size: 9px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .price {
      margin: 2px 0 0;
      font-size: 12px;
      font-weight: 800;
      color: var(--accent);
    }
    .stock {
      margin: 0;
      font-size: 9px;
      font-weight: 700;
    }
    .stock.in { color: #166534; }
    .stock.out { color: #9f1239; }
    .wa-label {
      margin-top: auto;
      display: block;
      text-align: center;
      border-radius: 999px;
      background: #128c47;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 5px 6px;
    }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 7px;
      padding-top: 6px;
      border-top: 1px solid #e7eee9;
      font-size: 10px;
      color: var(--muted);
    }
    .cover {
      background: linear-gradient(165deg, #ffffff 0%, var(--surface) 100%);
    }
    .cover-hero h1 {
      margin: 18px 0 8px;
      font-size: 34px;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    .cover-hero p { margin: 0; color: var(--muted); font-size: 13px; }
    .stats {
      display: flex;
      gap: 10px;
      margin: 20px 0 18px;
    }
    .stat {
      flex: 1;
      border-radius: 12px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e4efe8;
    }
    .stat strong { display: block; font-size: 20px; margin-top: 4px; }
    .stat span {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .toc-title { margin: 0 0 8px; font-size: 18px; }
    .toc-note { margin: 0 0 10px; color: var(--muted); font-size: 12px; }
    .toc-row {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 6px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #e4efe8;
    }
    .toc-num {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 12px;
      color: #fff;
      background: var(--accent);
    }
    .toc-name { font-weight: 700; font-size: 13px; }
    .toc-count { color: var(--muted); font-size: 12px; }
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
    <p>${escapeHtml(catalogue.name)} brochure · ${totalProducts} products · ${categories.length} categories</p>
    <button type="button" onclick="window.print()">Download / Print PDF</button>
  </div>

  <section class="sheet cover" id="toc">
    <div class="cover-hero">
      ${brandBlock(catalogue, accent)}
      <h1>${escapeHtml(catalogue.name)} Product Brochure</h1>
      <p>Print-ready catalogue booklet. Every category continues until all products are shown.</p>
      <div class="wa-cover">WhatsApp orders · ${escapeHtml(whatsappUrl.replace(/^https?:\/\/wa\.me\//, "").split("?")[0] || "TFRC")}</div>
      <div class="stats">
        <div class="stat"><span>Products</span><strong>${totalProducts}</strong></div>
        <div class="stat"><span>Categories</span><strong>${categories.length}</strong></div>
        <div class="stat"><span>Generated</span><strong style="font-size:15px">${escapeHtml(dateLabel)}</strong></div>
      </div>
    </div>
    <h2 class="toc-title">Categories</h2>
    <p class="toc-note">Use this index when assembling the printed brochure.</p>
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
