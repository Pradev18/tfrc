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
  return `${categoryName} curated for ${catalogueName} — order easily on WhatsApp.`;
}

function sizeChips(product: CataloguePdfProduct): string {
  if (!product.availableSizes.length) {
    return `<div class="sizes sizes--empty" aria-hidden="true"></div>`;
  }
  const chips = product.availableSizes
    .map((size) => `<span class="size-chip">${escapeHtml(size)}</span>`)
    .join("");
  return `<div class="sizes">${chips}</div>`;
}

function whatsappIconSvg(className = "wa-ico"): string {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 2.4 17.3L1.5 22.5l5.3-.9A11 11 0 1 0 20.5 3.5zm-8.6 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.1.5.5-3-.2-.3a9.1 9.1 0 1 1 7.7 4.3zm5-6.8c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.1-.3a.5.5 0 0 0 0-.5l-.9-2.1c-.2-.6-.5-.5-.6-.5h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.5 4 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.6.1 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.6-.3z"/></svg>`;
}

function featureIcon(kind: "quality" | "range" | "order" | "trust"): string {
  const paths: Record<typeof kind, string> = {
    quality:
      '<path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 3l7 3v5c0 5-3.2 8.5-7 10-3.8-1.5-7-5-7-10V6l7-3z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M9 12l2 2 4-4"/>',
    range:
      '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M8 12h8M12 8v8"/>',
    order:
      '<path fill="none" stroke="currentColor" stroke-width="1.7" d="M4 6h2l2.2 9h9.3l2-6H8"/><circle cx="10" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/>',
    trust:
      '<path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 15.8 7.2 17.6l.9-5.3L4.3 8.6l5.3-.8z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

function categoryGlyph(): string {
  return `<svg class="cat-glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c1.4 0 2.5 1.1 2.5 2.5S13.4 7.5 12 7.5 9.5 6.4 9.5 5 10.6 2.5 12 2.5zm-4.8 6.2c1.2 0 2.1.9 2.1 2.1v1.2c0 .6-.5 1.1-1.1 1.1H6.9c-.6 0-1.1-.5-1.1-1.1V10.8c0-1.2.9-2.1 2.1-2.1zm9.6 0c1.2 0 2.1.9 2.1 2.1v1.2c0 .6-.5 1.1-1.1 1.1h-1.3c-.6 0-1.1-.5-1.1-1.1V10.8c0-1.2.9-2.1 2.1-2.1zM12 9.2c2.7 0 4.8 1.5 4.8 4.1v6.1c0 .9-.7 1.6-1.6 1.6H8.8c-.9 0-1.6-.7-1.6-1.6v-6.1c0-2.6 2.1-4.1 4.8-4.1z"/></svg>`;
}

export function renderCatalogueHeader(payload: CataloguePdfPayload): string {
  const { catalogue } = payload;
  const logo = catalogue.logoUrl
    ? `<div class="logo-slot logo-slot--catalogue">
        <img class="catalogue-logo" src="${escapeAttr(catalogue.logoUrl)}" alt="${escapeAttr(catalogue.name)}" />
      </div>`
    : `<div class="logo-slot logo-slot--empty" aria-hidden="true"></div>`;

  return `
    <header class="sheet-header">
      <div class="logo-slot logo-slot--tfrc">
        <img class="tfrc-logo" src="${TFRC_LOGO_SRC}" alt="TFRC" />
      </div>
      <div class="header-identity">
        <div class="header-rule" aria-hidden="true"></div>
        <div class="header-copy">
          <p class="header-name">${escapeHtml(catalogue.name)}</p>
          ${
            catalogue.tagline
              ? `<p class="header-tagline">${escapeHtml(catalogue.tagline)}</p>`
              : `<p class="header-tagline">Product catalogue by TFRC</p>`
          }
        </div>
        <div class="header-features" aria-hidden="true">
          <span>${featureIcon("quality")} Quality</span>
          <span>${featureIcon("order")} Easy order</span>
        </div>
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
        <p class="footer-sub">Trusted catalogue by TFRC</p>
      </div>
      <div class="footer-values">
        <span>Quality Products</span>
        <span class="dot">·</span>
        <span>Wide Range</span>
        <span class="dot">·</span>
        <span>Easy Ordering</span>
      </div>
      <div class="footer-wa">
        ${whatsappIconSvg("wa-ico wa-ico--lg")}
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
    <section class="category-band">
      <div class="category-band-main">
        ${categoryGlyph()}
        <div>
          <h1>${escapeHtml(category.name)}</h1>
          <p>${escapeHtml(categoryBlurb(category.name, payload.catalogue.name))}</p>
        </div>
      </div>
      <div class="category-band-meta">
        <p class="category-counts">
          ${category.productCount} items · ${category.products.length} cards · ${onThisPage} on this page
        </p>
        <span class="page-pill">Page ${pageIndex + 1} of ${pageCount}</span>
      </div>
    </section>`;
}

export function renderQrCodePanel(
  title: string,
  subtitle: string,
  qrDataUrl: string,
  href: string
): string {
  return `
    <a class="qr-panel" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">
      <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="${escapeAttr(title)} QR code" />
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
      </div>`
    )
    .join("");

  const catalogueLogo = catalogue.logoUrl
    ? `<img class="cover-catalogue-logo" src="${escapeAttr(catalogue.logoUrl)}" alt="${escapeAttr(
        catalogue.name
      )}" />`
    : `<div class="cover-catalogue-logo cover-catalogue-logo--empty" aria-hidden="true"></div>`;

  return `
    <section class="sheet cover" id="toc">
      <header class="cover-top">
        <img class="cover-tfrc" src="${TFRC_LOGO_SRC}" alt="TFRC" />
        ${catalogueLogo}
      </header>

      <div class="cover-hero">
        ${
          catalogue.tagline
            ? `<p class="cover-kicker"><span></span>${escapeHtml(
                catalogue.tagline.toUpperCase()
              )}<span></span></p>`
            : ""
        }
        <h1>${escapeHtml(catalogue.name)}</h1>
        <p class="cover-pill">Product Brochure</p>
        <p class="cover-lead">${escapeHtml(
          catalogue.description ||
            `Browse ${catalogue.name} by category and order on WhatsApp with TFRC.`
        )}</p>
      </div>

      <div class="feature-row">
        <div class="feature">${featureIcon("quality")}<span>Quality &amp; Safe</span></div>
        <div class="feature">${featureIcon("range")}<span>Wide Range of Products</span></div>
        <div class="feature">${featureIcon("order")}<span>Easy Ordering</span></div>
        <div class="feature">${featureIcon("trust")}<span>Trusted by TFRC</span></div>
      </div>

      <div class="stats">
        <div class="stat">
          <span>Products</span>
          <strong>${totalProducts}</strong>
        </div>
        <div class="stat">
          <span>Categories</span>
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
        <p class="toc-note">Live index for this brochure — names and counts come from the catalogue.</p>
        <div class="toc-grid">${indexRows || "<p class='toc-empty'>No products found.</p>"}</div>
      </div>

      <div class="qr-row">
        ${renderQrCodePanel(
          "Visit Our Website",
          "Explore the full range of products",
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
      --wa: #128c47;
      --line: #d7e4dc;
      --cream: #f4f8f5;
      --ink: #121212;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      max-width: 210mm;
      color: var(--heading);
      background: #d9e3dc;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin-inline: auto;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 40;
      width: 210mm;
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 3mm 4mm;
      background: #fff;
      border-bottom: 1px solid var(--line);
    }
    .toolbar p { margin: 0; font-size: 12pt; color: var(--muted); }
    .toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 11pt;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: var(--cta);
    }

    /* ========== A4 SHEET ========== */
    .sheet {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 0;
      padding: 6mm 6.5mm 5mm;
      background: #fff;
      box-shadow: none;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
      position: relative;
    }

    /* ========== PRODUCT PAGE HEADER ~22mm ========== */
    .sheet-header {
      flex: 0 0 20mm;
      height: 20mm;
      max-height: 20mm;
      display: grid;
      grid-template-columns: 28mm 1fr 32mm;
      gap: 3mm;
      align-items: center;
      padding: 0 0.5mm 2mm;
      margin-bottom: 1.5mm;
      border-bottom: 0.4mm solid var(--line);
      background: linear-gradient(180deg, var(--cream) 0%, #fff 100%);
    }
    .logo-slot {
      height: 16mm;
      display: flex;
      align-items: center;
      overflow: hidden;
    }
    .logo-slot--tfrc { justify-content: flex-start; }
    .logo-slot--catalogue { justify-content: flex-end; }
    .logo-slot--empty { visibility: hidden; }
    .tfrc-logo {
      height: 15mm;
      width: auto;
      max-width: 26mm;
      object-fit: contain;
      display: block;
    }
    .catalogue-logo {
      max-height: 15mm;
      max-width: 30mm;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: right center;
      display: block;
    }
    .header-identity {
      min-width: 0;
      display: grid;
      grid-template-columns: 1.2mm 1fr auto;
      gap: 3mm;
      align-items: center;
    }
    .header-rule {
      width: 1.2mm;
      height: 12mm;
      border-radius: 1mm;
      background: var(--accent);
    }
    .header-name {
      margin: 0;
      font-size: 14pt;
      line-height: 1.1;
      font-weight: 800;
      color: var(--cta);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-tagline {
      margin: 1mm 0 0;
      font-size: 8pt;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-features {
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
      color: var(--cta);
      font-size: 7pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .header-features span {
      display: inline-flex;
      align-items: center;
      gap: 1.2mm;
    }
    .header-features svg { width: 3.2mm; height: 3.2mm; }

    /* ========== CATEGORY BAND ~16mm ========== */
    .category-band {
      flex: 0 0 14mm;
      height: 14mm;
      max-height: 14mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4mm;
      margin-bottom: 2mm;
      padding: 0 0.5mm;
    }
    .category-band-main {
      display: flex;
      gap: 2.5mm;
      align-items: flex-start;
      min-width: 0;
    }
    .cat-glyph {
      width: 7mm;
      height: 7mm;
      color: var(--cta);
      flex-shrink: 0;
      margin-top: 0.5mm;
    }
    .category-band h1 {
      margin: 0;
      font-size: 18pt;
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--cta);
    }
    .category-band p {
      margin: 1mm 0 0;
      font-size: 8pt;
      color: var(--muted);
      max-width: 120mm;
    }
    .category-band-meta { text-align: right; flex-shrink: 0; }
    .category-counts {
      margin: 0 0 1.5mm;
      font-size: 8pt;
      font-weight: 650;
      color: var(--muted);
    }
    .page-pill {
      display: inline-block;
      border-radius: 999px;
      background: var(--cta);
      color: #fff;
      font-size: 8pt;
      font-weight: 800;
      padding: 1.4mm 3.5mm;
    }

    /* ========== PRODUCT GRID — majority of page ========== */
    .grid {
      flex: 1 1 auto;
      min-height: 228mm;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 2.4mm;
      align-content: stretch;
      overflow: hidden;
    }
    .card {
      height: 100%;
      max-height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border: 0.35mm solid #d9e5de;
      border-radius: 2.2mm;
      background: #fff;
      overflow: hidden;
      box-shadow: 0 0.6mm 1.6mm rgba(20, 40, 30, 0.05);
    }
    .card-image {
      flex: 0 0 60%;
      height: 60%;
      max-height: 60%;
      min-height: 0;
      padding: 2.2mm;
      background: linear-gradient(180deg, #f7faf8 0%, #eef4f0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-bottom: 0.3mm solid #e5eee9;
    }
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      background: #fff;
      border-radius: 1.4mm;
    }
    .card-body {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
      padding: 2mm 2.2mm 2.2mm;
      overflow: hidden;
    }
    .card-title {
      margin: 0;
      font-size: 10pt;
      line-height: 1.2;
      font-weight: 800;
      color: var(--cta);
      min-height: 2.4em;
      max-height: 2.4em;
      overflow: hidden;
      flex-shrink: 0;
    }
    .card-meta {
      margin: 0;
      font-size: 7.5pt;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .sizes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8mm;
      min-height: 4.2mm;
      max-height: 4.2mm;
      overflow: hidden;
      flex-shrink: 0;
    }
    .sizes--empty { visibility: hidden; }
    .size-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 0.9mm;
      border: 0.25mm solid #c9ddd2;
      background: #f2f7f4;
      color: #14352a;
      font-size: 7pt;
      font-weight: 800;
      line-height: 1;
      padding: 0.7mm 1.3mm;
      white-space: nowrap;
    }
    .card-price {
      margin: 0.4mm 0 0;
      font-size: 12pt;
      line-height: 1.1;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.01em;
      flex-shrink: 0;
    }
    .card-stock {
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 1.1mm;
      font-size: 7.5pt;
      font-weight: 700;
      flex-shrink: 0;
    }
    .card-stock.in { color: #166534; }
    .card-stock.out { color: #9f1239; }
    .stock-dot {
      width: 1.6mm;
      height: 1.6mm;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .card-wa {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 1.4mm;
      width: 100%;
      min-height: 6.5mm;
      border-radius: 1.4mm;
      background: var(--wa);
      color: #fff !important;
      text-decoration: none !important;
      font-size: 8pt;
      font-weight: 800;
      padding: 1.4mm 2mm;
      flex-shrink: 0;
    }
    .wa-ico { width: 3.4mm; height: 3.4mm; flex-shrink: 0; }
    .wa-ico--lg { width: 6mm; height: 6mm; }

    /* ========== FOOTER ~16mm ========== */
    .sheet-footer {
      flex: 0 0 15mm;
      height: 15mm;
      max-height: 15mm;
      display: grid;
      grid-template-columns: 1.1fr 1.4fr 1fr;
      gap: 3mm;
      align-items: center;
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 0.4mm solid var(--line);
    }
    .footer-name {
      margin: 0;
      font-size: 12pt;
      font-weight: 800;
      color: var(--cta);
    }
    .footer-sub {
      margin: 0.6mm 0 0;
      font-size: 7.5pt;
      color: var(--muted);
    }
    .footer-values {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1.6mm;
      flex-wrap: wrap;
      text-align: center;
      font-size: 7.5pt;
      font-weight: 750;
      letter-spacing: 0.02em;
      color: var(--muted);
      text-transform: uppercase;
    }
    .footer-values .dot { opacity: 0.5; }
    .footer-wa {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 2mm;
      color: var(--wa);
    }
    .footer-wa-label {
      margin: 0;
      font-size: 7.5pt;
      font-weight: 700;
      color: var(--muted);
    }
    .footer-wa-phone {
      margin: 0.3mm 0 0;
      font-size: 12pt;
      font-weight: 800;
      color: var(--heading);
      letter-spacing: -0.01em;
    }

    /* ========== COVER ========== */
    .cover {
      background:
        radial-gradient(ellipse at 8% 0%, color-mix(in srgb, var(--accent) 14%, white), transparent 45%),
        radial-gradient(ellipse at 100% 8%, color-mix(in srgb, var(--accent) 10%, white), transparent 40%),
        #fff;
    }
    .cover-top {
      flex: 0 0 22mm;
      height: 22mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 2mm;
      border-bottom: 0.35mm solid var(--line);
      margin-bottom: 4mm;
    }
    .cover-tfrc {
      height: 16mm;
      width: auto;
      max-width: 34mm;
      object-fit: contain;
    }
    .cover-catalogue-logo {
      max-height: 16mm;
      max-width: 42mm;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: right center;
    }
    .cover-catalogue-logo--empty {
      width: 30mm;
      height: 16mm;
      visibility: hidden;
    }
    .cover-hero {
      text-align: center;
      flex-shrink: 0;
      margin-bottom: 4mm;
    }
    .cover-kicker {
      margin: 0 0 3mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3mm;
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.16em;
      color: var(--cta);
    }
    .cover-kicker span {
      width: 10mm;
      height: 0.35mm;
      background: color-mix(in srgb, var(--accent) 50%, white);
    }
    .cover-hero h1 {
      margin: 0;
      font-size: 34pt;
      line-height: 1.02;
      letter-spacing: -0.03em;
      font-weight: 800;
      color: var(--cta);
    }
    .cover-pill {
      display: inline-block;
      margin: 3.5mm 0 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 16%, white);
      color: var(--cta);
      font-size: 11pt;
      font-weight: 800;
      padding: 1.6mm 5mm;
    }
    .cover-lead {
      margin: 3.5mm auto 0;
      max-width: 150mm;
      font-size: 10.5pt;
      line-height: 1.45;
      color: var(--muted);
    }
    .feature-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 3mm;
      margin: 0 0 4mm;
      flex-shrink: 0;
    }
    .feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2mm;
      text-align: center;
      color: var(--cta);
      font-size: 8pt;
      font-weight: 750;
    }
    .feature svg {
      width: 10mm;
      height: 10mm;
      padding: 2mm;
      border-radius: 999px;
      border: 0.35mm solid color-mix(in srgb, var(--accent) 30%, white);
      background: #fff;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5mm;
      flex-shrink: 0;
      margin-bottom: 3mm;
    }
    .stat {
      border: 0.35mm solid var(--line);
      border-radius: 3mm;
      background: #fff;
      padding: 3.5mm 4mm;
      text-align: center;
    }
    .stat span {
      display: block;
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .stat strong {
      display: block;
      margin-top: 1mm;
      font-size: 28pt;
      line-height: 1;
      font-weight: 800;
      color: var(--heading);
    }
    .variant-note {
      margin: 0 0 3mm;
      font-size: 8.5pt;
      line-height: 1.4;
      color: var(--muted);
      flex-shrink: 0;
    }
    .toc-block {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      margin-bottom: 3mm;
    }
    .toc-block h2 {
      margin: 0;
      font-size: 15pt;
      font-weight: 800;
      color: var(--cta);
    }
    .toc-note {
      margin: 1mm 0 2.5mm;
      font-size: 8.5pt;
      color: var(--muted);
    }
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm 3mm;
    }
    .toc-row {
      display: grid;
      grid-template-columns: 6mm 1fr auto;
      gap: 2mm;
      align-items: center;
      padding: 2mm 2.5mm;
      border-radius: 2mm;
      border: 0.3mm solid var(--line);
      background: #fff;
    }
    .toc-num {
      width: 5.5mm;
      height: 5.5mm;
      border-radius: 1.2mm;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 8pt;
      font-weight: 800;
    }
    .toc-name {
      font-size: 9.5pt;
      font-weight: 750;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toc-count {
      font-size: 9.5pt;
      font-weight: 750;
      color: var(--muted);
    }
    .toc-empty {
      grid-column: 1 / -1;
      color: var(--muted);
      font-size: 10pt;
    }
    .qr-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5mm;
      flex-shrink: 0;
      margin-bottom: 3mm;
    }
    .qr-panel {
      display: grid;
      grid-template-columns: 22mm 1fr;
      gap: 3mm;
      align-items: center;
      min-height: 28mm;
      padding: 3mm;
      border-radius: 3mm;
      border: 0.4mm solid var(--line);
      background: #fff;
      text-decoration: none !important;
      color: inherit !important;
      box-shadow: 0 0.8mm 2mm rgba(20, 40, 30, 0.05);
    }
    .qr-image {
      width: 22mm;
      height: 22mm;
      object-fit: contain;
      border-radius: 1.4mm;
      border: 0.3mm solid #e8efe9;
      background: #fff;
    }
    .qr-title {
      margin: 0;
      font-size: 11pt;
      font-weight: 800;
      color: var(--heading);
    }
    .qr-sub {
      margin: 1mm 0 2mm;
      font-size: 8.5pt;
      color: var(--muted);
    }
    .qr-cta {
      display: inline-block;
      border-radius: 999px;
      background: var(--cta);
      color: #fff;
      font-size: 8pt;
      font-weight: 800;
      padding: 1.2mm 3mm;
    }
    .cover-bar {
      flex-shrink: 0;
      border-radius: 2mm;
      background: var(--cta);
      color: #fff;
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      padding: 2.8mm 3.5mm;
      font-size: 8pt;
      font-weight: 750;
    }

    @media print {
      html, body {
        background: #fff !important;
        width: 210mm !important;
        max-width: 210mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .toolbar { display: none !important; }
      .sheet {
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
      }
      .category-sheet, .cover {
        page-break-after: always;
        break-after: page;
      }
      .category-sheet:last-of-type {
        page-break-after: auto;
        break-after: auto;
      }
      .card, .qr-panel, .sheet-header, .sheet-footer, .category-band {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
    @page {
      size: A4 portrait;
      margin: 0;
    }
  `;
}

export function buildCataloguePdfHtml(
  payload: CataloguePdfPayload,
  options?: { autoPrint?: boolean }
) {
  return `<!DOCTYPE html>
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
}
