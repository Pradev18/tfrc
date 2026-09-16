"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REPORT_ROWS_PER_PAGE,
  TFRC_REPORT_LOGO_SRC,
} from "@/lib/report/office-report-pdf-html";
import {
  alternateImageUrls,
  isBrowserDisplayableImageUrl,
  reportDisplaySrc,
  toProxiedReportImageSrc,
} from "@/lib/report/report-image-src";

type PrintMeta = {
  id: string;
  title: string;
  customerName: string;
  requestedBy: string;
  shopBranch: string;
  notes: string;
  reportDate: string;
  tfrcLabel: string;
  lineCount: number;
};

type ReportLine = {
  id: string;
  sortOrder: number;
  itemCode: string;
  imageLink: string;
  itemName: string;
  supplierName: string;
  onHand: string;
  itemCost: string;
  sellingPrice: string;
  wholesalePriceApproval: string;
};

/** Hostinger-safe batch size: 10 A4 pages with images. */
const SECTION_ROWS = 100;
const FETCH_PAGE_SIZE = 100;

async function waitForImages(root: ParentNode, timeoutMs = 30000) {
  const imgs = Array.from(root.querySelectorAll("img.product-img")) as HTMLImageElement[];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const finish = () => resolve();
          const settle = async () => {
            try {
              if (typeof img.decode === "function") await img.decode();
            } catch {
              // decode can reject for broken images — still settle
            }
            finish();
          };

          if (img.complete && img.naturalWidth > 0) {
            void settle();
            return;
          }
          if (img.complete && img.naturalWidth === 0) {
            finish();
            return;
          }

          img.addEventListener("load", () => void settle(), { once: true });
          img.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, timeoutMs);
        })
    )
  );
}

function imageLinkLabel(_url: string): string {
  return "View Image";
}

function tfrcFieldValue(label: string | undefined): string {
  const value = (label || "").trim();
  // Workbook label is TFRC; the value cell under it is blank unless the user typed one.
  if (!value || value.toUpperCase() === "TFRC") return "";
  return value;
}

function reportImageCandidates(remoteUrl: string): string[] {
  const remotes = [...new Set([remoteUrl, ...alternateImageUrls(remoteUrl)].filter(Boolean))];
  remotes.sort((a, b) => {
    const aOk = isBrowserDisplayableImageUrl(a) ? 0 : 1;
    const bOk = isBrowserDisplayableImageUrl(b) ? 0 : 1;
    return aOk - bOk;
  });
  // JPG/PNG load directly. EMF/WMF must go through the converter proxy first.
  if (!isBrowserDisplayableImageUrl(remoteUrl)) {
    return [
      toProxiedReportImageSrc(remoteUrl),
      ...remotes.filter((url) => isBrowserDisplayableImageUrl(url)),
    ];
  }
  return [...remotes, ...remotes.map((url) => toProxiedReportImageSrc(url))];
}

function ReportProductImage({ remoteUrl }: { remoteUrl: string }) {
  const candidates = useMemo(() => reportImageCandidates(remoteUrl), [remoteUrl]);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[attempt] ?? "";

  if (!current) return <div className="img-empty" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      className="product-img"
      src={current}
      alt=""
      loading="eager"
      decoding="async"
      onError={() => {
        setAttempt((n) => (n + 1 < candidates.length ? n + 1 : candidates.length));
      }}
    />
  );
}

export function ReportPrintClient({
  reportId,
  initialMeta,
}: {
  reportId: string;
  initialMeta: PrintMeta;
}) {
  const [meta] = useState(initialMeta);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionCount = Math.max(1, Math.ceil(meta.lineCount / SECTION_ROWS));
  const sectionStart = sectionIndex * SECTION_ROWS;
  const sectionEnd = Math.min(sectionStart + SECTION_ROWS, meta.lineCount);
  const totalPdfPages = Math.max(1, Math.ceil(meta.lineCount / REPORT_ROWS_PER_PAGE));

  const pages = useMemo(() => {
    if (lines.length === 0) return [];
    const out: ReportLine[][] = [];
    for (let i = 0; i < lines.length; i += REPORT_ROWS_PER_PAGE) {
      out.push(lines.slice(i, i + REPORT_ROWS_PER_PAGE));
    }
    return out;
  }, [lines]);

  const loadSection = useCallback(
    async (index: number) => {
      setLoading(true);
      setError(null);
      try {
        const startRow = index * SECTION_ROWS;
        const endRow = Math.min(startRow + SECTION_ROWS, meta.lineCount);
        const needed = endRow - startRow;
        if (needed <= 0) {
          setLines([]);
          setSectionIndex(index);
          return;
        }
        const startPage = Math.floor(startRow / FETCH_PAGE_SIZE) + 1;
        const pageCount = Math.ceil(needed / FETCH_PAGE_SIZE);
        const collected: ReportLine[] = [];
        for (let p = 0; p < pageCount; p++) {
          const page = startPage + p;
          const res = await fetch(
            `/api/admin/reports/${reportId}/lines?page=${page}&pageSize=${FETCH_PAGE_SIZE}`,
            { cache: "no-store" }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load report rows");
          const batch = (data.report?.lines ?? []) as ReportLine[];
          if (batch.length === 0) break;
          for (const line of batch) {
            if (line.sortOrder > startRow && line.sortOrder <= endRow) {
              collected.push(line);
            }
          }
        }
        collected.sort((a, b) => a.sortOrder - b.sortOrder);
        setLines(collected);
        setSectionIndex(index);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load section");
      } finally {
        setLoading(false);
      }
    },
    [meta.lineCount, reportId]
  );

  useEffect(() => {
    void loadSection(0);
  }, [loadSection]);

  async function handlePrint() {
    if (printing || lines.length === 0) return;
    setPrinting(true);
    try {
      // Give React a paint so proxied <img> nodes exist, then wait for loads.
      await new Promise((r) => window.requestAnimationFrame(() => r(undefined)));
      const root = document.querySelector(".report-print-root");
      if (root) await waitForImages(root, 45000);
      await new Promise((r) => window.setTimeout(r, 400));
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="report-print-root">
      <div className="admin-toolbar no-print">
        <div>
          <p className="toolbar-title">{meta.title}</p>
          <p className="toolbar-meta">
            Section {sectionIndex + 1}/{sectionCount} · rows {sectionStart + 1}–
            {sectionEnd} of {meta.lineCount} · {totalPdfPages} A4 page(s)
          </p>
        </div>
        <div className="toolbar-actions">
          <Link href={`/admin/reports/${reportId}`} className="btn-secondary">
            ← Editor
          </Link>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || sectionIndex <= 0}
            onClick={() => void loadSection(sectionIndex - 1)}
          >
            Prev section
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || sectionIndex >= sectionCount - 1}
            onClick={() => void loadSection(sectionIndex + 1)}
          >
            Next section
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading || printing || lines.length === 0}
            onClick={() => void handlePrint()}
          >
            {printing ? "Preparing…" : "Print / Save PDF"}
          </button>
        </div>
      </div>

      {error && <p className="status-error no-print">{error}</p>}
      {loading && <p className="status-muted no-print">Loading section…</p>}

      <div className="preview-stage">
        {!loading &&
          pages.map((pageLines, pageIndex) => {
            const globalPage =
              Math.floor(sectionStart / REPORT_ROWS_PER_PAGE) + pageIndex + 1;
            const isLastPageOfReport =
              sectionIndex === sectionCount - 1 && pageIndex === pages.length - 1;

            return (
              <article
                key={`page-${sectionIndex}-${pageIndex}`}
                className={`report-page${isLastPageOfReport ? " report-page--final" : ""}`}
              >
                <header className="rp-header">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="rp-logo"
                    src={TFRC_REPORT_LOGO_SRC}
                    alt="TFRC"
                    width={120}
                    height={72}
                  />
                  <div className="rp-brand">
                    <p className="rp-ar">الشركة الأولى لبيع التجزئة (ذ.م.م)</p>
                    <h1>THE FIRST RETAIL COMPANY (W.L.L)</h1>
                    <p className="rp-tag">Quality Products for a Better Tomorrow</p>
                    <h2>INVENTORY AVAILABILITY &amp; PRICE CHECK</h2>
                  </div>
                  <div className="rp-date">
                    <span className="rp-label">DATE</span>
                    <div className="rp-field">{meta.reportDate || ""}</div>
                  </div>
                </header>

                <section className="rp-meta">
                  <div className="rp-meta-cell">
                    <span className="rp-label">CUSTOMER NAME</span>
                    <div className="rp-field">{meta.customerName || ""}</div>
                  </div>
                  <div className="rp-meta-cell">
                    <span className="rp-label">REQUESTED BY</span>
                    <div className="rp-field">{meta.requestedBy || ""}</div>
                  </div>
                  <div className="rp-meta-cell">
                    <span className="rp-label">SHOP / BRANCH</span>
                    <div className="rp-field">{meta.shopBranch || ""}</div>
                  </div>
                  <div className="rp-meta-cell rp-meta-cell--narrow">
                    <span className="rp-label">TFRC</span>
                    <div className="rp-field">{tfrcFieldValue(meta.tfrcLabel)}</div>
                  </div>
                </section>

                <section className="rp-notes">
                  <span className="rp-label">NOTES</span>
                  <div className="rp-field rp-field--notes">{meta.notes || ""}</div>
                </section>

                <div className="rp-table-wrap">
                  <table className="rp-table">
                    <colgroup>
                      <col className="col-num" />
                      <col className="col-code" />
                      <col className="col-link" />
                      <col className="col-img" />
                      <col className="col-name" />
                      <col className="col-supplier" />
                      <col className="col-onhand" />
                      <col className="col-cost" />
                      <col className="col-sell" />
                      <col className="col-ws" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item code</th>
                        <th>Image link</th>
                        <th>Image</th>
                        <th>Item Name</th>
                        <th>Supplier Name</th>
                        <th>On Hand</th>
                        <th>Item Cost</th>
                        <th>Selling Price</th>
                        <th>
                          Whole Sale
                          <br />
                          Price Approval
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageLines.map((line) => (
                          <tr key={line.id} className="rp-row">
                            <td className="c-num">{line.sortOrder}</td>
                            <td className="c-code">{line.itemCode}</td>
                            <td className="c-link">
                              {line.imageLink ? (
                                <a
                                  href={line.imageLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={line.imageLink}
                                >
                                  {imageLinkLabel(line.imageLink)}
                                </a>
                              ) : null}
                            </td>
                            <td className="c-img">
                              {line.imageLink ? (
                                <ReportProductImage remoteUrl={line.imageLink} />
                              ) : (
                                <div className="img-empty" />
                              )}
                            </td>
                            <td className="c-name">{line.itemName}</td>
                            <td className="c-supplier">{line.supplierName}</td>
                            <td className="c-onhand">{line.onHand}</td>
                            <td className="c-cost">{line.itemCost}</td>
                            <td className="c-sell">{line.sellingPrice}</td>
                            <td className="c-ws">{line.wholesalePriceApproval}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isLastPageOfReport ? (
                  <section className="rp-approval">
                    <div className="rp-approval-card">
                      <div className="rp-approval-head">PREPARED BY</div>
                      <div className="rp-approval-body">
                        <p>Name:</p>
                        <p>Signature / date:</p>
                        <div className="rp-stamp" />
                      </div>
                    </div>
                    <div className="rp-approval-card">
                      <div className="rp-approval-head">CHECKED BY</div>
                      <div className="rp-approval-body">
                        <p>Name:</p>
                        <p>Signature / date:</p>
                        <div className="rp-stamp" />
                      </div>
                    </div>
                  </section>
                ) : null}

                <footer className="rp-footer">
                  <span>
                    THE FIRST RETAIL COMPANY (W.L.L.) | Quality Products | Trusted Partners |
                    Sustainable Growth
                  </span>
                  <span>
                    Page {globalPage} of {totalPdfPages}
                  </span>
                </footer>
              </article>
            );
          })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: REPORT_A4_CSS }} />
    </div>
  );
}

/**
 * Full-page A4 geometry in physical units only (mm / pt).
 * Screen preview shows true 210×297mm sheets; print is 1:1 with no transform.
 */
const REPORT_A4_CSS = `
  :root {
    --rp-purple: #5B2C8B;
    --rp-lavender: #efe8f7;
    --rp-onhand: #dceefb;
    --rp-cost: #f5ecd8;
    --rp-sell: #f8dce8;
    --rp-ws: #fff3bf;
    --rp-line: #b9accb;
    --rp-ink: #1f1630;
    --rp-muted: #6b6280;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #cfc3dd;
    color: var(--rp-ink);
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .report-print-root { min-height: 100vh; }

  .admin-toolbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #d5cce0;
  }
  .toolbar-title { margin: 0; font-size: 14px; font-weight: 700; }
  .toolbar-meta { margin: 2px 0 0; font-size: 12px; color: var(--rp-muted); }
  .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn-primary, .btn-secondary {
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid #cfc3dd;
    background: #fff;
    color: var(--rp-ink);
  }
  .btn-primary {
    background: var(--rp-purple);
    border-color: var(--rp-purple);
    color: #fff;
  }
  .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  .status-error { margin: 12px 16px; color: #b91c1c; font-size: 13px; }
  .status-muted { margin: 12px 16px; color: var(--rp-muted); font-size: 13px; }

  /* Screen: show true A4 sheets centered (no transform scale on the page itself). */
  .preview-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px 12px 40px;
    background: #cfc3dd;
  }

  /* ===== TRUE A4 PAGE ===== */
  .report-page {
    box-sizing: border-box;
    width: 210mm;
    height: 297mm;
    max-width: 210mm;
    max-height: 297mm;
    margin: 0;
    padding: 6mm 7mm 5mm;
    background: #fff;
    color: var(--rp-ink);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 6px 28px rgba(40, 20, 60, 0.18);
    page-break-after: always;
    break-after: page;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .report-page:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }

  .rp-label {
    display: block;
    font-size: 7pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--rp-purple);
    line-height: 1.15;
  }
  .rp-field {
    margin-top: 1.2mm;
    min-height: 7mm;
    font-size: 10pt;
    font-weight: 600;
    line-height: 1.25;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .rp-field--notes { min-height: 10mm; }

  /* Header ~30mm */
  .rp-header {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 28mm 1fr 36mm;
    gap: 3mm;
    align-items: center;
    margin-bottom: 3mm;
    min-height: 28mm;
  }
  .rp-logo {
    width: 26mm;
    height: 16mm;
    object-fit: contain;
    display: block;
  }
  .rp-brand { text-align: center; }
  .rp-brand .rp-ar {
    margin: 0;
    font-size: 9pt;
    font-weight: 700;
    color: var(--rp-purple);
  }
  .rp-brand h1 {
    margin: 1mm 0 0;
    font-size: 13pt;
    font-weight: 800;
    color: var(--rp-purple);
    letter-spacing: 0.01em;
    line-height: 1.15;
  }
  .rp-brand .rp-tag {
    margin: 0.8mm 0 0;
    font-size: 7.5pt;
    color: var(--rp-muted);
  }
  .rp-brand h2 {
    margin: 2mm 0 0;
    font-size: 11.5pt;
    font-weight: 800;
    color: var(--rp-purple);
    border-bottom: 0.45mm solid var(--rp-purple);
    display: inline-block;
    padding-bottom: 0.8mm;
    line-height: 1.2;
  }
  .rp-date {
    border: 0.4mm solid var(--rp-purple);
    border-radius: 1.5mm;
    padding: 2mm 2.2mm;
    min-height: 18mm;
    background: #fff;
  }

  /* Request meta ~22mm */
  .rp-meta {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1.35fr 1fr 1fr 0.55fr;
    gap: 2.2mm;
    margin-bottom: 2.2mm;
  }
  .rp-meta-cell {
    border: 0.35mm solid var(--rp-line);
    border-radius: 1.4mm;
    background: var(--rp-lavender);
    padding: 1.8mm 2.2mm;
    min-height: 16mm;
  }

  /* Notes ~16mm */
  .rp-notes {
    flex: 0 0 auto;
    border: 0.35mm solid var(--rp-line);
    border-radius: 1.4mm;
    background: var(--rp-lavender);
    padding: 1.8mm 2.2mm;
    margin-bottom: 2.5mm;
    min-height: 14mm;
  }

  /* Table fills remaining height between notes and footer/approval */
  .rp-table-wrap {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    display: block;
  }
  .rp-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8pt;
  }
  .rp-table col.col-num { width: 8mm; }
  .rp-table col.col-code { width: 32mm; }
  .rp-table col.col-link { width: 18mm; }
  .rp-table col.col-img { width: 16mm; }
  .rp-table col.col-name { width: 42mm; }
  .rp-table col.col-supplier { width: 28mm; }
  .rp-table col.col-onhand { width: 13mm; }
  .rp-table col.col-cost { width: 14mm; }
  .rp-table col.col-sell { width: 14mm; }
  .rp-table col.col-ws { width: 16mm; }

  .rp-table th {
    background: var(--rp-purple);
    color: #fff;
    font-weight: 800;
    font-size: 7.2pt;
    line-height: 1.2;
    text-align: center;
    vertical-align: middle;
    border: 0.3mm solid #9b87b5;
    padding: 1.6mm 0.9mm;
    height: 13mm;
  }
  .rp-table td {
    border: 0.3mm solid var(--rp-line);
    padding: 1.4mm 1.1mm;
    vertical-align: middle;
    overflow: hidden;
    background: #fff;
  }

  /*
   * Explicit physical row heights so 10 rows consume the A4 body.
   * Continuation pages (no approval): ~19mm × 10 ≈ 190mm body.
   * Final page (with approval): ~15mm × 10 ≈ 150mm body.
   */
  .report-page:not(.report-page--final) .rp-table tbody tr.rp-row {
    height: 19mm;
  }
  .report-page--final .rp-table tbody tr.rp-row {
    height: 15mm;
  }

  .c-num { text-align: center; font-weight: 700; font-size: 8pt; }
  .c-code {
    font-family: ui-monospace, "Consolas", monospace;
    font-size: 7.5pt;
    white-space: nowrap;
    word-break: keep-all;
    overflow: visible;
    padding-left: 0.5mm;
    padding-right: 0.5mm;
  }
  .c-link a {
    color: #1d4ed8;
    text-decoration: underline;
    font-size: 7.5pt;
    line-height: 1.2;
    display: inline-block;
    white-space: nowrap;
  }
  .c-img { text-align: center; overflow: visible; }
  .c-img .product-img {
    width: 15mm;
    height: 15mm;
    max-width: 100%;
    object-fit: contain;
    display: inline-block;
    visibility: visible;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-page--final .c-img .product-img {
    width: 12mm;
    height: 12mm;
  }
  .img-empty {
    width: 15mm;
    height: 15mm;
    margin: 0 auto;
    border: 0.3mm dashed #ccc;
    border-radius: 1mm;
  }
  .report-page--final .img-empty {
    width: 12mm;
    height: 12mm;
  }
  .c-name {
    font-size: 8pt;
    line-height: 1.2;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .c-supplier {
    font-size: 7.5pt;
    line-height: 1.15;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .c-onhand {
    text-align: center;
    background: var(--rp-onhand) !important;
    font-weight: 700;
  }
  .c-cost {
    text-align: right;
    background: var(--rp-cost) !important;
    font-variant-numeric: tabular-nums;
  }
  .c-sell {
    text-align: right;
    background: var(--rp-sell) !important;
    font-variant-numeric: tabular-nums;
  }
  .c-ws {
    background: var(--rp-ws) !important;
    font-size: 8pt;
  }

  /* Approval ~36mm — final page only */
  .rp-approval {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3.5mm;
    margin-top: 3mm;
    min-height: 34mm;
  }
  .rp-approval-card {
    border: 0.4mm solid var(--rp-purple);
    border-radius: 1.5mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .rp-approval-head {
    background: var(--rp-purple);
    color: #fff;
    font-size: 8.5pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 1.8mm 2.5mm;
  }
  .rp-approval-body {
    flex: 1;
    padding: 2.5mm;
    font-size: 9pt;
    min-height: 24mm;
  }
  .rp-approval-body p { margin: 0 0 3mm; }
  .rp-stamp {
    margin-top: 1mm;
    height: 12mm;
    border: 0.3mm dashed #c4b7d6;
    border-radius: 1mm;
    background: #faf7fd;
  }

  /* Footer ~8mm */
  .rp-footer {
    flex: 0 0 auto;
    margin-top: auto;
    background: var(--rp-purple);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 3mm;
    padding: 1.8mm 2.5mm;
    font-size: 7pt;
    border-radius: 1mm;
    min-height: 7mm;
  }

  /*
   * Print must survive Windows "Print to PDF", which often uses US Letter
   * (279mm) and ignores a 297mm box. A 297mm sheet was splitting: table on
   * one page, footer on the next, plus a blank admin page and a trailing blank.
   * 268mm fits Letter and A4. Flex still fills that page; nothing overflows.
   */
  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }

    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    aside,
    nav,
    .no-print,
    .admin-toolbar {
      display: none !important;
    }

    body > div,
    main,
    .min-h-screen,
    .min-w-0 {
      display: block !important;
      width: auto !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    .preview-stage {
      display: block !important;
      padding: 0 !important;
      gap: 0 !important;
      background: #fff !important;
    }

    .report-page {
      box-shadow: none !important;
      margin: 0 !important;
      width: 204mm !important;
      height: 268mm !important;
      max-width: 204mm !important;
      max-height: 268mm !important;
      overflow: hidden !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: page !important;
      page-break-after: always !important;
    }
    .report-page:last-of-type {
      break-after: auto !important;
      page-break-after: auto !important;
    }

    .report-page .rp-header {
      display: grid !important;
      min-height: 18mm;
      margin-bottom: 1.5mm;
      overflow: visible;
    }
    .report-page .rp-logo { width: 18mm; height: 12mm; }
    .report-page .rp-brand .rp-ar,
    .report-page .rp-brand .rp-tag { font-size: 7pt; margin: 0; }
    .report-page .rp-brand h1 { font-size: 10.5pt; margin: 0.4mm 0 0; }
    .report-page .rp-brand h2 { font-size: 9pt; margin: 0.6mm 0 0; }
    .report-page .rp-date { min-height: 14mm; padding: 1.2mm; }
    .report-page .rp-meta-cell,
    .report-page .rp-notes { min-height: 11mm; }
    .report-page .rp-notes { margin-bottom: 2mm; }
    .report-page .rp-table th { height: 10mm; }
    .report-page .rp-table tbody tr.rp-row,
    .report-page--final .rp-table tbody tr.rp-row { height: 16mm !important; }
    .report-page--final .rp-table tbody tr.rp-row { height: 13mm !important; }
    .report-page .c-img .product-img,
    .report-page--final .c-img .product-img { width: 12mm; height: 12mm; }
    .report-page .rp-approval { min-height: 22mm; margin-top: 2mm; }
    .report-page .rp-footer { min-height: 6mm; }
  }
`;
