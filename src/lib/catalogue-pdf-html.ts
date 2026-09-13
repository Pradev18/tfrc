import type { CataloguePdfPayload, CataloguePdfProduct } from "@/services/catalogue-pdf.service";

export const PDF_PRODUCTS_PER_PAGE = 12;
export const PDF_COLS = 4;
export const PDF_ROWS = 3;

/** Official TFRC mark — always present; never replaced by catalogue data. */
export const TFRC_LOGO_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 72" role="img" aria-label="TFRC">
  <rect x="12" y="8" width="16" height="40" rx="2" fill="#7B2D8E"/>
  <rect x="40" y="8" width="16" height="40" rx="2" fill="#7B2D8E"/>
  <rect x="68" y="8" width="16" height="40" rx="2" fill="#7B2D8E"/>
  <text x="48" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#7B2D8E" letter-spacing="2">TFRC</text>
</svg>`);

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

function categoryBlurb(categoryName: string, catalogueName: string): string {
  return `${categoryName} selected for ${catalogueName} — browse and order on WhatsApp.`;
}

function sizeChips(product: CataloguePdfProduct): string {
  if (!product.availableSizes.length) {
    return `<div class="sizes sizes--empty" aria-hidden="true"></div>`;
  }
  const chips = product.availableSizes
    .map((size) => `<span class="size-chip">${escapeHtml(size)}</span>`)
    .join("");
  return `<div class="sizes" aria-label="Available sizes">${chips}</div>`;
}

function whatsappIconSvg(): string {
  return `<svg class="wa-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 2.4 17.3L1.5 22.5l5.3-.9A11 11 0 1 0 20.5 3.5zm-8.6 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.1.5.5-3-.2-.3a9.1 9.1 0 1 1 7.7 4.3zm5-6.8c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.1-.3a.5.5 0 0 0 0-.5l-.9-2.1c-.2-.6-.5-.5-.6-.5h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.5 4 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.6.1 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.6-.3z"/></svg>`;
}

function featureIcon(kind: "quality" | "range" | "order" | "trust"): string {
  const paths: Record<typeof kind, string> = {
    quality:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 3l7 3v5c0 5-3.2 8.5-7 10-3.8-1.5-7-5-7-10V6l7-3z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M9 12l2 2 4-4"/>',
    range:
      '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 12h8M12 8v8"/>',
    order:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 6h2l2.2 9h9.3l2-6H8"/><circle cx="10" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/>',
    trust:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 15.8 7.2 17.6l.9-5.3L4.3 8.6l5.3-.8z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

function categoryGlyph(): string {
  return `<svg class="cat-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 12h8M12 8v8"/></svg>`;
}

export function renderCatalogueHeader(payload: CataloguePdfPayload): string {
  const { catalogue } = payload;
  const logo = catalogue.logoUrl
    ? `<div class="logo-slot logo-slot--catalogue"><img class="catalogue-logo" src="${escapeAttr(
        catalogue.logoUrl
      )}" alt="${escapeAttr(catalogue.name)}" /></div>`
    : `<div class="logo-slot logo-slot--empty" aria-hidden="true"></div>`;

  return `
    <header class="sheet-brand">
      <div class="logo-slot logo-slot--tfrc">
        <img class="tfrc-logo" src="${TFRC_LOGO_SRC}" alt="TFRC" />
      </div>
      <div class="brand-mid">
        <p class="brand-name">${escapeHtml(catalogue.name)}</p>
        ${
          catalogue.tagline
            ? `<p class="brand-tag">${escapeHtml(catalogue.tagline)}</p>`
            : ""
        }
      </div>
      ${logo}
    </header>`;
}

export function renderCatalogueFooter(payload: CataloguePdfPayload): string {
  const phone = payload.whatsappPhone || "WhatsApp";
  return `
    <footer class="sheet-footer">
      <div class="footer-brand">
        <p class="footer-name">${escapeHtml(payload.catalogue.name)}</p>
        <p class="footer-values">QUALITY PRODUCTS · WIDE RANGE · TRUSTED BY TFRC</p>
      </div>
      <div class="footer-wa">
        ${whatsappIconSvg()}
        <div>
          <p class="footer-wa-label">WhatsApp Orders</p>
          <p class="footer-wa-phone">${escapeHtml(phone)}</p>
        </div>
      </div>
    </footer>`;
}

export function renderProductCard(product: CataloguePdfProduct): string {
  const priceLabel = `${product.priceFrom ? "From " : ""}${formatPdfPrice(
    product.price,
    product.currency
  )}`;
  return `
    <article class="card">
      <div class="card-image">
        <img src="${escapeAttr(product.imageUrl || "")}" alt="${escapeAttr(product.displayName)}" />
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(product.displayName)}</h3>
        <p class="card-meta">Item code: ${escapeHtml(product.productId)}</p>
        ${sizeChips(product)}
        <p class="card-price">${escapeHtml(priceLabel)}</p>
        <p class="card-stock ${product.inStock ? "in" : "out"}">
          <span class="stock-dot"></span>${product.inStock ? "In stock" : "Check availability"}
        </p>
        <a class="card-wa" href="${escapeAttr(product.whatsappUrl)}" target="_blank" rel="noopener noreferrer">
          ${whatsappIconSvg()}
          <span>WhatsApp Order</span>
        </a>
      </div>
    </article>`;
}

export function renderProductGrid(products: CataloguePdfProduct[]): string {
  return `<div class="grid">${products.map(renderProductCard).join("")}</div>`;
}

export function renderCategoryHeader(
  payload: CataloguePdfPayload,
  category: CataloguePdfPayload["categories"][number],
  pageIndex: number,
  pageCount: number,
  onThisPage: number
): string {
  return `
    <div class="category-head">
      <div class="category-head-main">
        ${categoryGlyph()}
        <div>
          <h1>${escapeHtml(category.name)}</h1>
          <p class="category-blurb">${escapeHtml(
            categoryBlurb(category.name, payload.catalogue.name)
          )}</p>
        </div>
      </div>
      <div class="category-head-meta">
        <p class="category-counts">
          ${category.productCount} items · ${category.products.length} cards · ${onThisPage} on this page
        </p>
        <span class="page-pill">Page ${pageIndex + 1} of ${pageCount}</span>
      </div>
    </div>`;
}

export function renderQrCodePanel(
  title: string,
  subtitle: string,
  qrDataUrl: string,
  href: string
): string {
  return `
    <a class="qr-panel" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">
      <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="${escapeAttr(title)} QR" />
      <div class="qr-copy">
        <p class="qr-title">${escapeHtml(title)}</p>
        <p class="qr-sub">${escapeHtml(subtitle)}</p>
        <span class="qr-cta">Scan QR code</span>
      </div>
    </a>`;
}

export function renderCoverPage(payload: CataloguePdfPayload): string {
  const { catalogue, categories, totalProducts } = payload;
  const indexRows = categories
    .map(
      (cat, index) => `
      <div class="toc-row">
        <span class="toc-num" style="background:${escapeAttr(
          TOC_COLORS[index % TOC_COLORS.length]!
        )}">${index + 1}</span>
        <span class="toc-name">${escapeHtml(cat.name)}</span>
        <span class="toc-count">${cat.productCount}</span>
        <span class="toc-chevron" aria-hidden="true">›</span>
      </div>`
    )
    .join("");

  return `
    <section class="sheet cover" id="toc">
      ${renderCatalogueHeader(payload)}
      <div class="cover-hero">
        ${
          catalogue.tagline
            ? `<p class="cover-kicker"><span></span>${escapeHtml(
                catalogue.tagline.toUpperCase()
              )}<span></span></p>`
            : ""
        }
        <h1 class="cover-title">${escapeHtml(catalogue.name)}</h1>
        <p class="cover-pill">Product Brochure</p>
        <p class="cover-lead">${escapeHtml(
          catalogue.description ||
            `Browse ${catalogue.name} by category and order on WhatsApp with TFRC.`
        )}</p>
      </div>

      <div class="feature-row">
        <div class="feature">${featureIcon("quality")}<span>Quality &amp; Safe</span></div>
        <div class="feature">${featureIcon("range")}<span>Wide Range</span></div>
        <div class="feature">${featureIcon("order")}<span>Easy Ordering</span></div>
        <div class="feature">${featureIcon("trust")}<span>Trusted by TFRC</span></div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-label">Products</span>
          <strong>${totalProducts}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Categories</span>
          <strong>${categories.length}</strong>
        </div>
      </div>
      <p class="variant-note">
        Product count matches your catalogue import (${totalProducts} items).
        Size variants are grouped into one card with sizes listed
        (${payload.listedCards} cards in this brochure).
      </p>

      <div class="toc-block">
        <h2>Categories</h2>
        <p class="toc-note">Index for this brochure — names and counts come from the live catalogue.</p>
        <div class="toc-grid">
          ${indexRows || "<p class='toc-empty'>No products found.</p>"}
        </div>
      </div>

      <div class="qr-row">
        ${renderQrCodePanel(
          "Visit Our Website",
          "Explore full range of products",
          payload.websiteQrDataUrl,
          payload.websiteUrl
        )}
        ${renderQrCodePanel(
          "WhatsApp Orders",
          "Quick & easy ordering",
          payload.whatsappQrDataUrl,
          payload.whatsappUrl
        )}
      </div>

      <div class="cover-bar">
        <span>TFRC | ${escapeHtml(catalogue.name)} PRODUCT BROCHURE</span>
        <span>${escapeHtml(catalogue.tagline || "Order on WhatsApp")}</span>
      </div>
    </section>`;
}

const TOC_COLORS = [
  "#1b4332",
  "#c2410c",
  "#1d4ed8",
  "#7c3aed",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#334155",
];

function renderCategoryPages(payload: CataloguePdfPayload): string {
  return payload.categories
    .map((cat) => {
      const pages = chunkProducts(cat.products, PDF_PRODUCTS_PER_PAGE);
      return pages
        .map((pageProducts, pageIndex) => {
          const isFirst = pageIndex === 0;
          return `
          <section class="sheet category-sheet" ${
            isFirst ? `id="category-${escapeAttr(cat.slug)}"` : ""
          }>
            ${renderCatalogueHeader(payload)}
            ${renderCategoryHeader(
              payload,
              cat,
              pageIndex,
              pages.length,
              pageProducts.length
            )}
            ${renderProductGrid(pageProducts)}
            ${renderCatalogueFooter(payload)}
          </section>`;
        })
        .join("");
    })
    .join("");
}

function templateCss(payload: CataloguePdfPayload): string {
  return `
    :root {
      --accent: ${escapeAttr(payload.accent)};
      --heading: ${escapeAttr(payload.heading)};
      --muted: ${escapeAttr(payload.muted)};
      --surface: ${escapeAttr(payload.surface)};
      --cta: ${escapeAttr(payload.cta)};
      --line: color-mix(in srgb, var(--heading) 12%, white);
      --soft: color-mix(in srgb, var(--accent) 8%, white);
      --wa: #128c47;
      --ink: #141414;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--heading);
      background: #e7eee9;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 30;
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
      background: var(--cta);
    }
    .sheet {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 14px auto;
      padding: 8mm 8mm 7mm;
      background: #fff;
      box-shadow: 0 16px 40px rgba(15, 41, 34, 0.1);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      page-break-after: always;
      break-after: page;
    }
    .sheet-brand {
      display: grid;
      grid-template-columns: 56px 1fr 72px;
      gap: 10px;
      align-items: center;
      min-height: 46px;
      max-height: 52px;
      flex-shrink: 0;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 6px;
    }
    .logo-slot {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      overflow: hidden;
    }
    .logo-slot--tfrc { justify-content: flex-start; }
    .logo-slot--catalogue { justify-content: flex-end; }
    .logo-slot--empty { visibility: hidden; }
    .tfrc-logo {
      height: 40px;
      width: auto;
      max-width: 56px;
      object-fit: contain;
      display: block;
    }
    .catalogue-logo {
      max-height: 42px;
      max-width: 72px;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: right center;
      display: block;
    }
    .brand-mid { min-width: 0; text-align: center; }
    .brand-name {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-tag {
      margin: 1px 0 0;
      font-size: 9px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .category-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      flex-shrink: 0;
      margin-bottom: 6px;
    }
    .category-head-main {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      min-width: 0;
    }
    .cat-glyph {
      width: 22px;
      height: 22px;
      color: var(--accent);
      flex-shrink: 0;
      margin-top: 2px;
    }
    .category-head h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--heading);
    }
    .category-blurb {
      margin: 2px 0 0;
      font-size: 9.5px;
      color: var(--muted);
      max-width: 115mm;
    }
    .category-head-meta {
      text-align: right;
      flex-shrink: 0;
    }
    .category-counts {
      margin: 0 0 4px;
      font-size: 9px;
      color: var(--muted);
      font-weight: 600;
    }
    .page-pill {
      display: inline-block;
      border-radius: 999px;
      background: var(--cta);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 4px 9px;
    }
    .grid {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 5px;
      align-content: start;
      overflow: hidden;
    }
    .card {
      border: 1px solid #e2ebe5;
      border-radius: 10px;
      background: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      max-height: 100%;
      box-shadow: 0 1px 3px rgba(20, 40, 30, 0.04);
    }
    .card-image {
      flex: 0 0 50%;
      max-height: 50%;
      min-height: 0;
      padding: 4px;
      background: #f4f7f5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      background: #fff;
      border-radius: 6px;
    }
    .card-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 2px;
      padding: 5px 6px 6px;
    }
    .card-title {
      margin: 0;
      font-size: 9.5px;
      line-height: 1.25;
      font-weight: 800;
      color: var(--heading);
      min-height: 2.5em;
      max-height: 2.5em;
      overflow: hidden;
      flex-shrink: 0;
    }
    .card-meta {
      margin: 0;
      font-size: 7.5px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .sizes {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      min-height: 14px;
      max-height: 14px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .sizes--empty {
      visibility: hidden;
    }
    .size-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      border: 1px solid #d5e3db;
      background: #f3f7f4;
      color: #14352a;
      font-size: 7px;
      font-weight: 800;
      line-height: 1;
      padding: 2px 4px;
      white-space: nowrap;
    }
    .card-price {
      margin: 1px 0 0;
      font-size: 10.5px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.01em;
      flex-shrink: 0;
    }
    .card-stock {
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 7.5px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .card-stock.in { color: #166534; }
    .card-stock.out { color: #9f1239; }
    .stock-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .card-wa {
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      border-radius: 7px;
      background: var(--wa);
      color: #fff !important;
      text-decoration: none !important;
      font-size: 8px;
      font-weight: 800;
      padding: 5px 6px;
      flex-shrink: 0;
    }
    .wa-ico { width: 11px; height: 11px; flex-shrink: 0; }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px solid var(--line);
      min-height: 28px;
    }
    .footer-name {
      margin: 0;
      font-size: 12px;
      font-weight: 800;
      color: var(--cta);
    }
    .footer-values {
      margin: 1px 0 0;
      font-size: 7.5px;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 700;
    }
    .footer-wa {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--wa);
    }
    .footer-wa .wa-ico { width: 18px; height: 18px; }
    .footer-wa-label {
      margin: 0;
      font-size: 8px;
      font-weight: 700;
      color: var(--muted);
    }
    .footer-wa-phone {
      margin: 0;
      font-size: 12px;
      font-weight: 800;
      color: var(--heading);
      letter-spacing: -0.01em;
    }
    .cover {
      background:
        radial-gradient(ellipse at 10% 0%, color-mix(in srgb, var(--accent) 12%, white), transparent 42%),
        radial-gradient(ellipse at 95% 15%, color-mix(in srgb, var(--accent) 8%, white), transparent 40%),
        #fff;
    }
    .cover-hero { text-align: center; margin-top: 4px; flex-shrink: 0; }
    .cover-kicker {
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: var(--cta);
    }
    .cover-kicker span {
      display: block;
      width: 28px;
      height: 1px;
      background: color-mix(in srgb, var(--accent) 45%, white);
    }
    .cover-title {
      margin: 0;
      font-size: 34px;
      line-height: 1.05;
      letter-spacing: -0.03em;
      font-weight: 800;
      color: var(--cta);
    }
    .cover-pill {
      display: inline-block;
      margin: 8px 0 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 16%, white);
      color: var(--cta);
      font-size: 11px;
      font-weight: 800;
      padding: 5px 12px;
    }
    .cover-lead {
      margin: 8px auto 0;
      max-width: 145mm;
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    .feature-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin: 12px 0 10px;
      flex-shrink: 0;
    }
    .feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      text-align: center;
      color: var(--cta);
      font-size: 8.5px;
      font-weight: 700;
    }
    .feature svg {
      width: 28px;
      height: 28px;
      padding: 5px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 28%, white);
      background: #fff;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex-shrink: 0;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fff;
      padding: 10px 12px;
      text-align: center;
    }
    .stat-label {
      display: block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .stat strong {
      display: block;
      margin-top: 2px;
      font-size: 26px;
      font-weight: 800;
      color: var(--heading);
      line-height: 1.1;
    }
    .variant-note {
      margin: 7px 0 8px;
      font-size: 9px;
      line-height: 1.4;
      color: var(--muted);
      flex-shrink: 0;
    }
    .toc-block { flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .toc-block h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: var(--cta);
    }
    .toc-note {
      margin: 2px 0 6px;
      font-size: 9.5px;
      color: var(--muted);
    }
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 8px;
    }
    .toc-row {
      display: grid;
      grid-template-columns: 22px 1fr auto 10px;
      gap: 6px;
      align-items: center;
      padding: 6px 8px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #fff;
    }
    .toc-num {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
    }
    .toc-name {
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toc-count { font-size: 10px; font-weight: 700; color: var(--muted); }
    .toc-chevron { color: var(--muted); font-size: 12px; }
    .toc-empty { grid-column: 1 / -1; color: var(--muted); font-size: 11px; }
    .qr-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
      flex-shrink: 0;
    }
    .qr-panel {
      display: grid;
      grid-template-columns: 54px 1fr;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: #fff;
      text-decoration: none !important;
      color: inherit !important;
    }
    .qr-image {
      width: 54px;
      height: 54px;
      object-fit: contain;
      border-radius: 6px;
      background: #fff;
      border: 1px solid #eef3ef;
    }
    .qr-title { margin: 0; font-size: 11px; font-weight: 800; color: var(--heading); }
    .qr-sub { margin: 2px 0 4px; font-size: 8.5px; color: var(--muted); }
    .qr-cta {
      display: inline-block;
      border-radius: 999px;
      background: var(--cta);
      color: #fff;
      font-size: 8px;
      font-weight: 800;
      padding: 3px 8px;
    }
    .cover-bar {
      margin-top: 8px;
      border-radius: 8px;
      background: var(--cta);
      color: #fff;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 10px;
      font-size: 8.5px;
      font-weight: 700;
      flex-shrink: 0;
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
      .category-sheet, .cover {
        page-break-after: always;
        break-after: page;
      }
      .category-sheet:last-of-type {
        page-break-after: auto;
        break-after: auto;
      }
      .card, .qr-panel, .sheet-brand, .sheet-footer {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
    @page { size: A4 portrait; margin: 0; }
  `;
}

export function buildCataloguePdfHtml(
  payload: CataloguePdfPayload,
  options?: { autoPrint?: boolean }
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.catalogue.name)} Product Brochure</title>
  <style>${templateCss(payload)}</style>
</head>
<body>
  <div class="toolbar">
    <p>${escapeHtml(payload.catalogue.name)} brochure · ${payload.totalProducts} products · ${
    payload.categories.length
  } categories · TFRC</p>
    <button type="button" onclick="window.print()">Download / Print PDF</button>
  </div>
  ${renderCoverPage(payload)}
  ${renderCategoryPages(payload)}
  <script>
    ${
      options?.autoPrint
        ? "window.addEventListener('load', () => setTimeout(() => window.print(), 280));"
        : ""
    }
  </script>
</body>
</html>`;

  return html;
}
