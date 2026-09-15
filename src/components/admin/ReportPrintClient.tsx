"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REPORT_ROWS_PER_PAGE,
  TFRC_REPORT_LOGO_SRC,
} from "@/lib/report/office-report-pdf-html";

type PrintMeta = {
  id: string;
  title: string;
  customerName: string;
  requestedBy: string;
  shopBranch: string;
  notes: string;
  reportDate: string;
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

/** With images on: keep sections small so print doesn't create blank overflow pages. */
const SECTION_ROWS_WITH_IMAGES = 100; // 10 A4 pages
const SECTION_ROWS_LITE = 500;
const FETCH_PAGE_SIZE = 100;

async function waitForImages(root: ParentNode, timeoutMs = 12000) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, timeoutMs);
        })
    )
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
  /** Default OFF so product images print. Lite = links only (faster, no photos). */
  const [liteImages, setLiteImages] = useState(false);

  const sectionRows = liteImages ? SECTION_ROWS_LITE : SECTION_ROWS_WITH_IMAGES;
  const sectionCount = Math.max(1, Math.ceil(meta.lineCount / sectionRows));
  const sectionStart = sectionIndex * sectionRows;
  const sectionEnd = Math.min(sectionStart + sectionRows, meta.lineCount);

  const pages = useMemo(() => {
    if (lines.length === 0) return [];
    const out: ReportLine[][] = [];
    for (let i = 0; i < lines.length; i += REPORT_ROWS_PER_PAGE) {
      out.push(lines.slice(i, i + REPORT_ROWS_PER_PAGE));
    }
    return out;
  }, [lines]);

  const loadSection = useCallback(
    async (index: number, rowsPerSection: number) => {
      setLoading(true);
      setError(null);
      try {
        const startRow = index * rowsPerSection;
        const endRow = Math.min(startRow + rowsPerSection, meta.lineCount);
        const needed = endRow - startRow;
        if (needed <= 0) {
          setLines([]);
          setSectionIndex(index);
          return;
        }

        // API pages are 1-based over sortOrder order.
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
    void loadSection(0, sectionRows);
  }, [loadSection, sectionRows]);

  async function handlePrint() {
    if (printing || lines.length === 0) return;
    setPrinting(true);
    try {
      const root = document.querySelector(".print-root");
      if (root) await waitForImages(root);
      // Let layout settle before Chrome paginates.
      await new Promise((r) => window.setTimeout(r, 200));
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  const totalPdfPages = Math.ceil(meta.lineCount / REPORT_ROWS_PER_PAGE) || 1;

  return (
    <div className="print-root bg-[#d8d0e4] text-[#1f1630]">
      <div className="print-toolbar sticky top-0 z-20 mx-auto flex w-[210mm] flex-wrap items-center justify-between gap-3 border-b border-[#cfc3dd] bg-white px-3 py-2">
        <div className="text-sm">
          <p className="font-semibold">{meta.title}</p>
          <p className="text-xs text-[#6b6280]">
            Section {sectionIndex + 1}/{sectionCount} · rows {sectionStart + 1}–
            {sectionEnd} of {meta.lineCount} · ~{totalPdfPages} PDF pages total
          </p>
          <label className="mt-1 flex items-center gap-2 text-xs text-[#6b6280]">
            <input
              type="checkbox"
              checked={liteImages}
              onChange={(e) => {
                setLiteImages(e.target.checked);
                setSectionIndex(0);
              }}
            />
            Lite mode (hide product photos — only if print is too heavy)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/reports/${reportId}`}
            className="rounded border border-[#cfc3dd] px-3 py-1.5 text-sm"
          >
            ← Editor
          </Link>
          <button
            type="button"
            className="rounded border border-[#cfc3dd] px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={loading || sectionIndex <= 0}
            onClick={() => void loadSection(sectionIndex - 1, sectionRows)}
          >
            Prev section
          </button>
          <button
            type="button"
            className="rounded border border-[#cfc3dd] px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={loading || sectionIndex >= sectionCount - 1}
            onClick={() => void loadSection(sectionIndex + 1, sectionRows)}
          >
            Next section
          </button>
          <button
            type="button"
            className="rounded bg-[#5B2C8B] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading || printing || lines.length === 0}
            onClick={() => void handlePrint()}
          >
            {printing ? "Preparing images…" : "Print / Save PDF"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-auto mt-3 w-[210mm] text-sm text-red-700 print-hide">{error}</p>
      )}
      {loading && (
        <p className="mx-auto mt-3 w-[210mm] text-sm text-[#6b6280] print-hide">
          Loading section…
        </p>
      )}

      {!loading &&
        pages.map((pageLines, pageIndex) => {
          const globalPage =
            Math.floor(sectionStart / REPORT_ROWS_PER_PAGE) + pageIndex + 1;
          const isLastSheetOfReport =
            sectionIndex === sectionCount - 1 && pageIndex === pages.length - 1;
          return (
            <section key={`sheet-${sectionIndex}-${pageIndex}`} className="sheet">
              <header className="doc-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="logo"
                  src={TFRC_REPORT_LOGO_SRC}
                  alt="TFRC"
                  width={80}
                  height={48}
                />
                <div className="brand">
                  <p className="ar">الشركة الأولى لبيع التجزئة (ذ.م.م)</p>
                  <h1>THE FIRST RETAIL COMPANY (W.L.L)</h1>
                  <p className="tag">Quality Products for a Better Tomorrow</p>
                  <h2>INVENTORY AVAILABILITY &amp; PRICE CHECK</h2>
                </div>
                <div className="date-box">
                  <span>DATE</span>
                  <div>{meta.reportDate || "—"}</div>
                </div>
              </header>

              <div className="meta-grid">
                <MetaField label="CUSTOMER NAME" value={meta.customerName} />
                <MetaField label="REQUESTED BY" value={meta.requestedBy} />
                <MetaField label="SHOP / BRANCH" value={meta.shopBranch} />
                <MetaField label="TFRC" value="TFRC" />
              </div>
              {meta.notes ? (
                <div className="notes-field">
                  <span className="field-label">NOTES</span>
                  <div className="field-value">{meta.notes}</div>
                </div>
              ) : null}

              <table className="grid">
                <thead>
                  <tr>
                    <th className="c-num">#</th>
                    <th className="c-code">Item code</th>
                    <th className="c-link">Image link</th>
                    <th className="c-img">Image</th>
                    <th className="c-name">Item Name</th>
                    <th className="c-supplier">Supplier</th>
                    <th className="c-onhand">On Hand</th>
                    <th className="c-cost">Item Cost</th>
                    <th className="c-sell">Selling</th>
                    <th className="c-ws">Wholesale</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: REPORT_ROWS_PER_PAGE }).map((_, idx) => {
                    const line = pageLines[idx];
                    const n =
                      sectionStart + pageIndex * REPORT_ROWS_PER_PAGE + idx + 1;
                    if (!line) {
                      return (
                        <tr key={`empty-${n}`} className="empty-row">
                          <td className="c-num">{n}</td>
                          <td colSpan={9} />
                        </tr>
                      );
                    }
                    return (
                      <tr key={line.id}>
                        <td className="c-num">{line.sortOrder}</td>
                        <td className="c-code">{line.itemCode}</td>
                        <td className="c-link">
                          {line.imageLink ? (
                            <a
                              className="img-link"
                              href={line.imageLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {line.imageLink}
                            </a>
                          ) : null}
                        </td>
                        <td className="c-img">
                          {line.imageLink && !liteImages ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={line.imageLink}
                              alt=""
                              loading="eager"
                              decoding="sync"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.style.visibility = "hidden";
                              }}
                            />
                          ) : (
                            <div className="img-fallback" />
                          )}
                        </td>
                        <td className="c-name">{line.itemName}</td>
                        <td className="c-supplier">{line.supplierName}</td>
                        <td className="c-onhand">{line.onHand}</td>
                        <td className="c-cost">{line.itemCost}</td>
                        <td className="c-sell">{line.sellingPrice}</td>
                        <td className="c-ws">{line.wholesalePriceApproval}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {isLastSheetOfReport ? (
                <div className="approval">
                  <ApprovalBox title="PREPARED BY" />
                  <ApprovalBox title="CHECKED BY" />
                </div>
              ) : (
                <div className="spacer" />
              )}

              <footer className="doc-footer">
                <span>
                  THE FIRST RETAIL COMPANY (W.L.L.) | Quality Products | Trusted
                  Partners
                </span>
                <span>
                  Page {globalPage} of {totalPdfPages}
                </span>
              </footer>
            </section>
          );
        })}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --purple: #5B2C8B;
          --lavender: #efe8f7;
          --onhand: #dceefb;
          --cost: #f5ecd8;
          --sell: #f8dce8;
          --ws: #fff3bf;
          --line: #cfc3dd;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0; padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .sheet {
          width: 210mm;
          height: 297mm;
          max-height: 297mm;
          margin: 8px auto;
          background: #fff;
          overflow: hidden;
          padding: 6mm 6mm 5mm;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 12px rgba(0,0,0,.08);
          break-inside: avoid;
          page-break-inside: avoid;
          page-break-after: always;
          break-after: page;
        }
        .sheet:last-of-type {
          page-break-after: auto;
          break-after: auto;
        }
        .doc-header {
          display: grid;
          grid-template-columns: 22mm 1fr 28mm;
          gap: 3mm;
          align-items: center;
          margin-bottom: 2mm;
          flex: 0 0 auto;
        }
        .logo { width: 20mm; height: 12mm; object-fit: contain; display: block; }
        .brand { text-align: center; }
        .brand .ar { margin: 0; font-size: 9pt; color: var(--purple); font-weight: 700; }
        .brand h1 { margin: 1mm 0 0; font-size: 12pt; color: var(--purple); }
        .brand .tag { margin: 0.6mm 0 0; font-size: 7pt; color: #6b6280; }
        .brand h2 {
          margin: 1.5mm 0 0; font-size: 11pt; color: var(--purple);
          border-bottom: 0.4mm solid var(--purple); display: inline-block; padding-bottom: 0.6mm;
        }
        .date-box {
          border: 0.35mm solid var(--purple); border-radius: 1.5mm; padding: 1.5mm;
          min-height: 12mm; background: #fff;
        }
        .date-box span {
          display: block; font-size: 7pt; font-weight: 800; color: var(--purple); letter-spacing: 0.08em;
        }
        .date-box div { margin-top: 1mm; font-size: 10pt; font-weight: 700; }
        .meta-grid {
          display: grid; grid-template-columns: 1.3fr 1fr 1fr 0.55fr; gap: 2mm; margin-bottom: 2mm;
          flex: 0 0 auto;
        }
        .meta-field, .notes-field {
          border: 0.3mm solid var(--line); border-radius: 1.4mm; background: var(--lavender);
          min-height: 10mm; padding: 1.2mm 2mm;
        }
        .notes-field { margin-bottom: 2mm; }
        .field-label {
          display: block; font-size: 6.5pt; font-weight: 800; color: var(--purple); letter-spacing: 0.06em;
        }
        .field-value { margin-top: 1mm; min-height: 4mm; font-size: 8.5pt; font-weight: 600; white-space: pre-wrap; }
        .grid {
          width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.2pt;
          flex: 1 1 auto;
        }
        .grid th, .grid td {
          border: 0.28mm solid #b9accb; padding: 0.8mm 0.6mm; vertical-align: middle; overflow: hidden;
        }
        .grid th {
          background: var(--purple); color: #fff; font-weight: 800; text-align: center; font-size: 5.8pt;
        }
        .c-num { width: 5mm; text-align: center; }
        .c-code { width: 16mm; word-break: break-all; font-family: ui-monospace, monospace; }
        .c-link { width: 20mm; }
        .c-img { width: 12mm; text-align: center; }
        .c-name { width: 34mm; }
        .c-supplier { width: 24mm; }
        .c-onhand { width: 11mm; text-align: center; background: var(--onhand) !important; }
        .c-cost { width: 14mm; text-align: right; background: var(--cost) !important; }
        .c-sell { width: 14mm; text-align: right; background: var(--sell) !important; }
        .c-ws { width: 16mm; background: var(--ws) !important; }
        .c-img img {
          width: 10mm; height: 10mm; object-fit: contain; display: inline-block; background: #fff;
        }
        .img-fallback {
          width: 10mm; height: 10mm; margin: 0 auto; border: 0.25mm dashed #ccc; border-radius: 1mm;
        }
        .img-link {
          color: #1d4ed8; text-decoration: underline; word-break: break-all; font-size: 5pt;
          line-height: 1.1; max-height: 11mm; overflow: hidden; display: block;
        }
        .empty-row td { height: 11mm; }
        .approval {
          display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 2mm; flex: 0 0 auto;
        }
        .approval-card { border: 0.35mm solid var(--purple); border-radius: 1.5mm; overflow: hidden; }
        .approval-head {
          background: var(--purple); color: #fff; font-size: 8pt; font-weight: 800;
          padding: 1.4mm 2mm; letter-spacing: 0.06em;
        }
        .approval-body { padding: 2mm; min-height: 20mm; font-size: 8pt; }
        .approval-body p { margin: 0 0 2mm; }
        .stamp-box {
          margin-top: 1mm; height: 10mm; border: 0.3mm dashed #c4b7d6; border-radius: 1mm; background: #faf7fd;
        }
        .spacer { flex: 1 1 auto; min-height: 0; }
        .doc-footer {
          margin-top: 1.5mm; background: var(--purple); color: #fff;
          display: flex; justify-content: space-between; gap: 3mm;
          padding: 1.5mm 2mm; font-size: 6pt; border-radius: 1mm; flex: 0 0 auto;
        }
        @media print {
          html, body { background: #fff !important; }
          .print-toolbar, .print-hide { display: none !important; }
          .print-root { background: #fff !important; }
          .sheet {
            margin: 0 !important;
            box-shadow: none !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .sheet:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        @page { size: A4 portrait; margin: 0; }
      `,
        }}
      />
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-field">
      <span className="field-label">{label}</span>
      <div className="field-value">{value || "—"}</div>
    </div>
  );
}

function ApprovalBox({ title }: { title: string }) {
  return (
    <div className="approval-card">
      <div className="approval-head">{title}</div>
      <div className="approval-body">
        <p>Name:</p>
        <p>Signature / date:</p>
        <div className="stamp-box" />
      </div>
    </div>
  );
}
