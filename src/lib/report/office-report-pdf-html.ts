import type { getOfficeReportDetail } from "@/services/office-report.service";

type ReportDetail = NonNullable<Awaited<ReturnType<typeof getOfficeReportDetail>>>;

export const REPORT_ROWS_PER_PAGE = 10;

const TFRC_MARK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <rect width="72" height="72" rx="10" fill="#5B2C8B"/>
  <rect x="16" y="16" width="8" height="28" rx="1.5" fill="#fff"/>
  <rect x="32" y="16" width="8" height="28" rx="1.5" fill="#fff"/>
  <rect x="48" y="16" width="8" height="28" rx="1.5" fill="#fff"/>
  <text x="36" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#fff" letter-spacing="1">TFRC</text>
</svg>`);

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

function chunkRows<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function renderFormField(label: string, value: string, wide = false): string {
  return `
    <div class="field ${wide ? "field--wide" : ""}">
      <span class="field-label">${escapeHtml(label)}</span>
      <div class="field-value">${escapeHtml(value)}</div>
    </div>`;
}

function renderTableRows(lines: ReportDetail["lines"], startIndex: number): string {
  const cells = lines.map((line, idx) => {
    const n = startIndex + idx + 1;
    const link = line.imageLink
      ? `<a class="img-link" href="${escapeAttr(line.imageLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(line.imageLink)}</a>`
      : "";
    const image = line.imageLink
      ? `<img src="${escapeAttr(line.imageLink)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><div class="img-fallback" style="display:none"></div>`
      : `<div class="img-fallback"></div>`;
    return `
      <tr>
        <td class="c-num">${n}</td>
        <td class="c-code">${escapeHtml(line.itemCode)}</td>
        <td class="c-link">${link}</td>
        <td class="c-img">${image}</td>
        <td class="c-name">${escapeHtml(line.itemName)}</td>
        <td class="c-supplier">${escapeHtml(line.supplierName)}</td>
        <td class="c-onhand">${escapeHtml(line.onHand)}</td>
        <td class="c-cost">${escapeHtml(line.itemCost)}</td>
        <td class="c-sell">${escapeHtml(line.sellingPrice)}</td>
        <td class="c-ws">${escapeHtml(line.wholesalePriceApproval)}</td>
      </tr>`;
  });

  while (cells.length < REPORT_ROWS_PER_PAGE) {
    const n = startIndex + cells.length + 1;
    cells.push(`
      <tr class="empty-row">
        <td class="c-num">${n}</td>
        <td></td><td></td><td></td><td></td><td></td><td class="c-onhand"></td><td class="c-cost"></td><td class="c-sell"></td><td class="c-ws"></td>
      </tr>`);
  }

  return cells.join("");
}

function renderApproval(): string {
  return `
    <section class="approval">
      <div class="approval-card">
        <div class="approval-head">PREPARED BY</div>
        <div class="approval-body">
          <p>Name:</p>
          <p>Signature / date:</p>
          <div class="stamp-box"></div>
        </div>
      </div>
      <div class="approval-card">
        <div class="approval-head">CHECKED BY</div>
        <div class="approval-body">
          <p>Name:</p>
          <p>Signature / date:</p>
          <div class="stamp-box"></div>
        </div>
      </div>
    </section>`;
}

function renderPage(
  report: ReportDetail,
  pageLines: ReportDetail["lines"],
  pageIndex: number,
  pageCount: number,
  startIndex: number,
  showApproval: boolean
): string {
  return `
  <section class="sheet">
    <header class="doc-header">
      <img class="logo" src="${TFRC_MARK}" alt="TFRC" />
      <div class="brand">
        <p class="ar">الشركة الأولى لبيع التجزئة (ذ.م.م)</p>
        <h1>THE FIRST RETAIL COMPANY (W.L.L)</h1>
        <p class="tag">Quality Products for a Better Tomorrow</p>
        <h2>INVENTORY AVAILABILITY &amp; PRICE CHECK</h2>
      </div>
      <div class="date-box">
        <span>DATE</span>
        <div>${escapeHtml(report.reportDate)}</div>
      </div>
    </header>

    <div class="meta-grid">
      ${renderFormField("CUSTOMER NAME", report.customerName)}
      ${renderFormField("REQUESTED BY", report.requestedBy)}
      ${renderFormField("SHOP / BRANCH", report.shopBranch)}
      ${renderFormField("TFRC", report.tfrcLabel || "TFRC")}
    </div>
    ${renderFormField("NOTES", report.notes, true)}

    <table class="grid">
      <thead>
        <tr>
          <th class="c-num">#</th>
          <th class="c-code">Item code</th>
          <th class="c-link">Image link</th>
          <th class="c-img">Image</th>
          <th class="c-name">Item Name</th>
          <th class="c-supplier">Supplier Name</th>
          <th class="c-onhand">On Hand</th>
          <th class="c-cost">Item Cost</th>
          <th class="c-sell">Selling Price</th>
          <th class="c-ws">Whole Sale Price Approval</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(pageLines, startIndex)}
      </tbody>
    </table>

    ${showApproval ? renderApproval() : `<div class="spacer"></div>`}

    <footer class="doc-footer">
      <span>THE FIRST RETAIL COMPANY (W.L.L.) | Quality Products | Trusted Partners | Sustainable Growth</span>
      <span>Page ${pageIndex + 1} of ${pageCount}</span>
    </footer>
  </section>`;
}

function templateCss(): string {
  return `
    :root {
      --purple: #5B2C8B;
      --lavender: #efe8f7;
      --onhand: #dceefb;
      --cost: #f5ecd8;
      --sell: #f8dce8;
      --ws: #fff3bf;
      --line: #cfc3dd;
      --ink: #1f1630;
      --muted: #6b6280;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #d8d0e4;
      color: var(--ink);
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 20;
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; padding: 10px 14px; background: #fff; border-bottom: 1px solid var(--line);
      width: 210mm; margin: 0 auto;
    }
    .toolbar button {
      border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 700;
      background: var(--purple); color: #fff; cursor: pointer;
    }
    .sheet {
      width: 210mm; height: 297mm; max-height: 297mm;
      margin: 8px auto; background: #fff; overflow: hidden;
      padding: 8mm 7mm 7mm;
      display: flex; flex-direction: column;
      page-break-after: always; break-after: page;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .doc-header {
      display: grid; grid-template-columns: 18mm 1fr 28mm; gap: 3mm;
      align-items: start; margin-bottom: 3mm;
    }
    .logo { width: 16mm; height: 16mm; object-fit: contain; }
    .brand { text-align: center; }
    .brand .ar { margin: 0; font-size: 9pt; color: var(--purple); font-weight: 700; }
    .brand h1 { margin: 1mm 0 0; font-size: 13pt; color: var(--purple); letter-spacing: 0.01em; }
    .brand .tag { margin: 0.8mm 0 0; font-size: 7.5pt; color: var(--muted); }
    .brand h2 {
      margin: 2mm 0 0; font-size: 12pt; color: var(--purple);
      border-bottom: 0.4mm solid var(--purple); display: inline-block; padding-bottom: 0.8mm;
    }
    .date-box {
      border: 0.35mm solid var(--purple); border-radius: 1.5mm; padding: 1.5mm;
      min-height: 14mm; background: #fff;
    }
    .date-box span {
      display: block; font-size: 7pt; font-weight: 800; color: var(--purple); letter-spacing: 0.08em;
    }
    .date-box div { margin-top: 1.5mm; min-height: 6mm; font-size: 10pt; font-weight: 700; }
    .meta-grid {
      display: grid; grid-template-columns: 1.3fr 1fr 1fr 0.55fr; gap: 2mm; margin-bottom: 2mm;
    }
    .field {
      border: 0.3mm solid var(--line); border-radius: 1.4mm; background: var(--lavender);
      min-height: 11mm; padding: 1.4mm 2mm;
    }
    .field--wide { margin-bottom: 2.5mm; min-height: 12mm; }
    .field-label {
      display: block; font-size: 6.5pt; font-weight: 800; color: var(--purple); letter-spacing: 0.06em;
    }
    .field-value { margin-top: 1mm; min-height: 5mm; font-size: 9pt; font-weight: 600; white-space: pre-wrap; }
    .grid {
      width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.4pt;
      flex: 1 1 auto;
    }
    .grid th, .grid td {
      border: 0.28mm solid #b9accb; padding: 1mm 0.8mm; vertical-align: middle;
      overflow: hidden;
    }
    .grid th {
      background: var(--purple); color: #fff; font-weight: 800; text-align: center;
      font-size: 6pt; line-height: 1.15;
    }
    .grid td { background: #fff; }
    .c-num { width: 5mm; text-align: center; }
    .c-code { width: 16mm; word-break: break-all; }
    .c-link { width: 22mm; }
    .c-img { width: 14mm; text-align: center; }
    .c-name { width: 34mm; }
    .c-supplier { width: 24mm; }
    .c-onhand { width: 11mm; text-align: center; background: var(--onhand) !important; }
    .c-cost { width: 14mm; text-align: right; background: var(--cost) !important; }
    .c-sell { width: 14mm; text-align: right; background: var(--sell) !important; }
    .c-ws { width: 18mm; background: var(--ws) !important; }
    .c-img img {
      width: 11mm; height: 11mm; object-fit: contain; display: inline-block; background: #fff;
    }
    .img-fallback {
      width: 11mm; height: 11mm; margin: 0 auto; border: 0.25mm dashed #ccc; border-radius: 1mm;
    }
    .img-link {
      color: #1d4ed8; text-decoration: underline; word-break: break-all; font-size: 5.4pt;
    }
    .empty-row td { height: 12mm; }
    .approval {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm;
    }
    .approval-card { border: 0.35mm solid var(--purple); border-radius: 1.5mm; overflow: hidden; }
    .approval-head {
      background: var(--purple); color: #fff; font-size: 8pt; font-weight: 800;
      padding: 1.6mm 2.5mm; letter-spacing: 0.06em;
    }
    .approval-body { padding: 2.5mm; min-height: 28mm; font-size: 8pt; }
    .approval-body p { margin: 0 0 3mm; }
    .stamp-box {
      margin-top: 2mm; height: 14mm; border: 0.3mm dashed #c4b7d6; border-radius: 1mm; background: #faf7fd;
    }
    .spacer { flex: 1 1 auto; }
    .doc-footer {
      margin-top: 2.5mm; background: var(--purple); color: #fff;
      display: flex; justify-content: space-between; gap: 3mm;
      padding: 2mm 2.5mm; font-size: 6.5pt; border-radius: 1mm;
    }
    @media print {
      html, body { background: #fff !important; }
      .toolbar { display: none !important; }
      .sheet { margin: 0 !important; box-shadow: none !important; }
    }
    @page { size: A4 portrait; margin: 0; }
  `;
}

export function buildOfficeReportPdfHtml(
  report: ReportDetail,
  options?: { autoPrint?: boolean }
): string {
  const pages = chunkRows(report.lines, REPORT_ROWS_PER_PAGE);
  const pageCount = pages.length;
  const sheets = pages
    .map((pageLines, pageIndex) =>
      renderPage(
        report,
        pageLines,
        pageIndex,
        pageCount,
        pageIndex * REPORT_ROWS_PER_PAGE,
        pageIndex === pageCount - 1
      )
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title || "Inventory Availability & Price Check")}</title>
  <style>${templateCss()}</style>
</head>
<body>
  <div class="toolbar">
    <p>${escapeHtml(report.title)} · ${report.lines.length} item(s) · TFRC</p>
    <button type="button" onclick="window.print()">Download / Print PDF</button>
  </div>
  ${sheets}
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
