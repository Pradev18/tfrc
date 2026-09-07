import type { CataloguePdfPayload } from "@/services/catalogue-pdf.service";

export const PDF_PRODUCTS_PER_PAGE = 12;
export const PDF_COLS = 3;
export const PDF_ROWS = 4;

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

export function buildCataloguePdfHtml(payload: CataloguePdfPayload, options?: { autoPrint?: boolean }) {
  const { catalogue, categories, totalProducts, accent, heading, muted, surface, generatedAt } =
    payload;
  const dateLabel = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const categoryOptions = categories
    .map(
      (cat) =>
        `<option value="#category-${escapeHtml(cat.slug)}">${escapeHtml(cat.name)} (${cat.productCount})</option>`
    )
    .join("");

  const coverLinks = categories
    .map(
      (cat, index) => `
      <a class="toc-row" href="#category-${escapeHtml(cat.slug)}">
        <span class="toc-num">${index + 1}</span>
        <span class="toc-name">${escapeHtml(cat.name)}</span>
        <span class="toc-count">${cat.productCount} products</span>
        <span class="toc-arrow">→</span>
      </a>`
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
                ${
                  product.imageUrl
                    ? `<img src="${escapeAttr(product.imageUrl)}" alt="" loading="lazy" />`
                    : `<div class="card-fallback">${escapeHtml(product.name.charAt(0) || "P")}</div>`
                }
              </div>
              <div class="card-body">
                <h3>${escapeHtml(product.name)}</h3>
                <p class="meta">ID ${escapeHtml(product.productId)}</p>
                ${product.size ? `<p class="meta">Size ${escapeHtml(product.size)}</p>` : ""}
                <p class="price">${escapeHtml(formatPdfPrice(product.price, product.currency))}</p>
                <span class="stock ${product.inStock ? "in" : "out"}">${
                  product.inStock ? "In Stock" : "Out of Stock"
                }</span>
              </div>
            </article>`
            )
            .join("");

          return `
          <section class="sheet category-sheet" ${isFirst ? `id="category-${escapeHtml(cat.slug)}"` : ""}>
            <header class="sheet-header">
              <div class="brand-row">
                <div class="brand-mark" style="background:${escapeAttr(accent)}20;color:${escapeAttr(accent)}">
                  ${(catalogue.name.charAt(0) || "C").toUpperCase()}
                </div>
                <div>
                  <p class="brand-name">${escapeHtml(catalogue.name)}</p>
                  <p class="brand-sub">Product catalogue</p>
                </div>
              </div>
              <div class="jump">
                <label for="jump-${escapeHtml(cat.slug)}-${pageIndex}">Jump to category</label>
                <select id="jump-${escapeHtml(cat.slug)}-${pageIndex}" class="jump-select" onchange="if(this.value){location.hash=this.value; this.selectedIndex=0;}">
                  <option value="">${escapeHtml(cat.name)} ▾</option>
                  ${categoryOptions}
                </select>
              </div>
            </header>

            <div class="title-block">
              <h1>${escapeHtml(cat.name)}${continued ? " <span>(continued)</span>" : ""}</h1>
              <p>${cat.productCount} products · page ${pageIndex + 1} of ${pages.length} in this category</p>
            </div>

            <div class="grid">
              ${cards}
            </div>

            <footer class="sheet-footer">
              <a href="#toc">Back to categories</a>
              <span>${escapeHtml(catalogue.name)} · ${dateLabel}</span>
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
  <title>${escapeHtml(catalogue.name)} Catalogue PDF</title>
  <style>
    :root {
      --accent: ${escapeAttr(accent)};
      --heading: ${escapeAttr(heading)};
      --muted: ${escapeAttr(muted)};
      --surface: ${escapeAttr(surface)};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--heading);
      background: #e8eee9;
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
      background: rgba(255,255,255,0.96);
      border-bottom: 1px solid #d5e3da;
      backdrop-filter: blur(8px);
    }
    .toolbar p { margin: 0; font-size: 13px; color: var(--muted); }
    .toolbar button, .toolbar a.button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      color: #fff;
      background: var(--accent);
    }
    .toolbar a.ghost {
      color: var(--heading);
      background: #edf4ef;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      padding: 14mm 12mm 12mm;
      background: #fff;
      box-shadow: 0 18px 50px rgba(15, 41, 34, 0.12);
      border-radius: 18px;
      page-break-after: always;
      break-after: page;
      position: relative;
      overflow: hidden;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 8px;
      background: linear-gradient(90deg, var(--accent), #ffe8d6);
    }
    .cover {
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, white), transparent 42%),
        linear-gradient(165deg, #ffffff 0%, var(--surface) 100%);
    }
    .cover-hero h1 {
      margin: 28px 0 8px;
      font-size: 42px;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    .cover-hero p { margin: 0; color: var(--muted); }
    .stats {
      display: flex;
      gap: 12px;
      margin: 28px 0 34px;
    }
    .stat {
      flex: 1;
      border-radius: 16px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.8);
      border: 1px solid color-mix(in srgb, var(--accent) 18%, white);
    }
    .stat strong { display: block; font-size: 22px; margin-top: 4px; }
    .stat span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .toc-title {
      margin: 0 0 8px;
      font-size: 22px;
    }
    .toc-note { margin: 0 0 14px; color: var(--muted); font-size: 13px; }
    .toc-row {
      display: grid;
      grid-template-columns: 36px 1fr auto 18px;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      margin-bottom: 8px;
      border-radius: 14px;
      text-decoration: none;
      color: inherit;
      background: #fff;
      border: 1px solid #e4efe8;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .toc-row:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(15,41,34,0.08);
    }
    .toc-num {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-weight: 700;
      color: #fff;
      background: var(--accent);
    }
    .toc-name { font-weight: 700; }
    .toc-count, .toc-arrow { color: var(--muted); font-size: 13px; }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .brand-row { display: flex; gap: 10px; align-items: center; }
    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 18px;
    }
    .brand-name { margin: 0; font-weight: 800; }
    .brand-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
    .jump {
      min-width: 210px;
      padding: 10px 12px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--accent) 10%, white);
      border: 1px solid color-mix(in srgb, var(--accent) 22%, white);
    }
    .jump label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .jump-select {
      width: 100%;
      border: 0;
      background: transparent;
      font-size: 14px;
      font-weight: 700;
      color: var(--heading);
      outline: none;
    }
    .title-block h1 {
      margin: 0;
      font-size: 30px;
      letter-spacing: -0.03em;
    }
    .title-block h1 span {
      font-size: 16px;
      font-weight: 600;
      color: var(--muted);
    }
    .title-block p {
      margin: 6px 0 16px;
      color: var(--muted);
      font-size: 13px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 10px;
      min-height: 210mm;
    }
    .card {
      border: 1px solid #e5eee8;
      border-radius: 16px;
      overflow: hidden;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%);
      display: flex;
      flex-direction: column;
      min-height: 0;
      box-shadow: 0 8px 20px rgba(15, 41, 34, 0.04);
    }
    .card-image {
      height: 92px;
      background: #f3f8f5;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #fff;
    }
    .card-fallback {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-weight: 800;
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, white);
    }
    .card-body { padding: 10px 11px 12px; }
    .card-body h3 {
      margin: 0 0 4px;
      font-size: 12.5px;
      line-height: 1.25;
      min-height: 2.5em;
    }
    .meta {
      margin: 0;
      font-size: 10.5px;
      color: var(--muted);
    }
    .price {
      margin: 8px 0 6px;
      font-size: 13px;
      font-weight: 800;
      color: var(--accent);
    }
    .stock {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 3px 8px;
    }
    .stock.in { color: #166534; background: #dcfce7; }
    .stock.out { color: #9f1239; background: #ffe4e6; }
    .stock.in::before, .stock.out::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e7eee9;
      font-size: 11px;
      color: var(--muted);
    }
    .sheet-footer a { color: var(--accent); font-weight: 700; text-decoration: none; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet {
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        width: auto;
        min-height: auto;
        height: auto;
      }
      .category-sheet, .cover {
        page-break-after: always;
        break-after: page;
      }
      .category-sheet:last-child, .cover:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      a { color: inherit; text-decoration: none; }
      .jump-select { border: 0; }
    }
    @page { size: A4; margin: 10mm; }
  </style>
</head>
<body>
  <div class="toolbar">
    <p>${escapeHtml(catalogue.name)} · ${totalProducts} products · ${categories.length} categories · Save as PDF from the print dialog</p>
    <div style="display:flex;gap:8px;">
      <a class="button ghost" href="#toc">Categories</a>
      <button type="button" onclick="window.print()">Download / Print PDF</button>
    </div>
  </div>

  <section class="sheet cover" id="toc">
    <div class="cover-hero">
      <div class="brand-row">
        <div class="brand-mark" style="background:${escapeAttr(accent)};color:#fff;width:56px;height:56px;font-size:24px;border-radius:18px">
          ${(catalogue.name.charAt(0) || "C").toUpperCase()}
        </div>
        <div>
          <p class="brand-name" style="font-size:18px">${escapeHtml(catalogue.name)}</p>
          <p class="brand-sub">${escapeHtml(catalogue.tagline || "Generated from Manage Catalogue")}</p>
        </div>
      </div>
      <h1>${escapeHtml(catalogue.name)} Product Catalogue</h1>
      <p>Every product below is grouped by category. Use the category list or the Jump menu on each page.</p>
      <div class="stats">
        <div class="stat"><span>Products</span><strong>${totalProducts}</strong></div>
        <div class="stat"><span>Categories</span><strong>${categories.length}</strong></div>
        <div class="stat"><span>Generated</span><strong style="font-size:16px">${escapeHtml(dateLabel)}</strong></div>
      </div>
    </div>
    <h2 class="toc-title" id="categories">Categories</h2>
    <p class="toc-note">Click a category to jump to its first page. Large categories continue across pages until every product is included.</p>
    ${coverLinks || "<p>No products found.</p>"}
  </section>

  ${categoryPages}
  <script>
    ${options?.autoPrint ? "window.addEventListener('load', () => setTimeout(() => window.print(), 400));" : ""}
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
