"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { REPORT_ROWS_PER_PAGE } from "@/lib/report/office-report-pdf-html";

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

/** Hostinger-safe: load & print in section-sized chunks so browser/origin never choke. */
const SECTION_ROWS = 500; // 50 A4 pages
const FETCH_PAGE_SIZE = 100;

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
  const [error, setError] = useState<string | null>(null);
  const [liteImages, setLiteImages] = useState(true);

  const sectionCount = Math.max(1, Math.ceil(meta.lineCount / SECTION_ROWS));
  const sectionStart = sectionIndex * SECTION_ROWS;
  const sectionEnd = Math.min(sectionStart + SECTION_ROWS, meta.lineCount);

  const pages = useMemo(() => {
    const out: ReportLine[][] = [];
    for (let i = 0; i < lines.length; i += REPORT_ROWS_PER_PAGE) {
      out.push(lines.slice(i, i + REPORT_ROWS_PER_PAGE));
    }
    return out.length ? out : [[]];
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
          return;
        }
        const startPage = Math.floor(startRow / FETCH_PAGE_SIZE) + 1;
        const collected: ReportLine[] = [];
        let page = startPage;
        while (collected.length < needed) {
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
          if (batch.length < FETCH_PAGE_SIZE) break;
          page += 1;
          if (page > startPage + Math.ceil(SECTION_ROWS / FETCH_PAGE_SIZE) + 2) break;
        }
        collected.sort((a, b) => a.sortOrder - b.sortOrder);
        setLines(collected.slice(0, needed));
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

  return (
    <div className="print-root min-h-screen bg-[#d8d0e4] text-[#1f1630]">
      <div className="print-toolbar sticky top-0 z-20 mx-auto flex w-[210mm] flex-wrap items-center justify-between gap-3 border-b border-[#cfc3dd] bg-white px-3 py-2 print:hidden">
        <div className="text-sm">
          <p className="font-semibold">{meta.title}</p>
          <p className="text-xs text-[#6b6280]">
            Section {sectionIndex + 1} / {sectionCount} · rows {sectionStart + 1}–
            {sectionEnd} of {meta.lineCount} (safe batches — avoids Hostinger crash)
          </p>
          <label className="mt-1 flex items-center gap-2 text-xs text-[#6b6280]">
            <input
              type="checkbox"
              checked={liteImages}
              onChange={(e) => setLiteImages(e.target.checked)}
            />
            Lite images (links only — recommended for large sections)
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
            onClick={() => void loadSection(sectionIndex - 1)}
          >
            Prev section
          </button>
          <button
            type="button"
            className="rounded border border-[#cfc3dd] px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={loading || sectionIndex >= sectionCount - 1}
            onClick={() => void loadSection(sectionIndex + 1)}
          >
            Next section
          </button>
          <button
            type="button"
            className="rounded bg-[#5B2C8B] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading || lines.length === 0}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-auto mt-3 w-[210mm] text-sm text-red-700 print:hidden">{error}</p>
      )}
      {loading && (
        <p className="mx-auto mt-3 w-[210mm] text-sm text-[#6b6280] print:hidden">
          Loading section…
        </p>
      )}

      {pages.map((pageLines, pageIndex) => (
        <section
          key={`sheet-${sectionIndex}-${pageIndex}`}
          className="sheet mx-auto my-2 flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[8mm_7mm_7mm] shadow print:my-0 print:shadow-none"
          style={{ pageBreakAfter: pageIndex === pages.length - 1 ? "auto" : "always" }}
        >
          <header className="mb-2 grid grid-cols-[18mm_1fr_28mm] items-start gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded bg-[#5B2C8B] text-[10px] font-bold text-white">
              TFRC
            </div>
            <div className="text-center">
              <p className="m-0 text-[9pt] font-bold text-[#5B2C8B]">
                الشركة الأولى لبيع التجزئة (ذ.م.م)
              </p>
              <h1 className="m-0 mt-1 text-[13pt] font-bold text-[#5B2C8B]">
                THE FIRST RETAIL COMPANY (W.L.L)
              </h1>
              <p className="m-0 mt-1 text-[7.5pt] text-[#6b6280]">
                Quality Products for a Better Tomorrow
              </p>
              <h2 className="m-0 mt-2 inline-block border-b border-[#5B2C8B] pb-1 text-[12pt] text-[#5B2C8B]">
                INVENTORY AVAILABILITY &amp; PRICE CHECK
              </h2>
            </div>
            <div className="rounded border border-[#5B2C8B] p-2 text-[7pt]">
              <span className="font-extrabold tracking-wide text-[#5B2C8B]">DATE</span>
              <div className="mt-1 text-[10pt] font-bold">{meta.reportDate || "—"}</div>
            </div>
          </header>

          <div className="mb-2 grid grid-cols-4 gap-2 text-[8pt]">
            <MetaField label="CUSTOMER" value={meta.customerName} />
            <MetaField label="REQUESTED BY" value={meta.requestedBy} />
            <MetaField label="SHOP / BRANCH" value={meta.shopBranch} />
            <MetaField label="ITEMS" value={`${meta.lineCount}`} />
          </div>
          {meta.notes ? (
            <div className="mb-2 rounded border border-[#cfc3dd] bg-[#efe8f7] p-2 text-[8pt]">
              <span className="font-extrabold text-[#5B2C8B]">NOTES</span>
              <div className="mt-1 whitespace-pre-wrap">{meta.notes}</div>
            </div>
          ) : null}

          <table className="w-full flex-1 table-fixed border-collapse text-[6.4pt]">
            <thead>
              <tr className="bg-[#5B2C8B] text-white">
                <th className="border border-[#b9accb] p-1">#</th>
                <th className="border border-[#b9accb] p-1">Item code</th>
                <th className="border border-[#b9accb] p-1">Image link</th>
                <th className="border border-[#b9accb] p-1">Img</th>
                <th className="border border-[#b9accb] p-1">Item Name</th>
                <th className="border border-[#b9accb] p-1">Supplier</th>
                <th className="border border-[#b9accb] p-1">On Hand</th>
                <th className="border border-[#b9accb] p-1">Item Cost</th>
                <th className="border border-[#b9accb] p-1">Selling</th>
                <th className="border border-[#b9accb] p-1">Wholesale</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: REPORT_ROWS_PER_PAGE }).map((_, idx) => {
                const line = pageLines[idx];
                const n = sectionStart + pageIndex * REPORT_ROWS_PER_PAGE + idx + 1;
                if (!line) {
                  return (
                    <tr key={`empty-${n}`} className="h-12">
                      <td className="border border-[#b9accb] p-1 text-center">{n}</td>
                      <td className="border border-[#b9accb]" colSpan={9} />
                    </tr>
                  );
                }
                return (
                  <tr key={line.id}>
                    <td className="border border-[#b9accb] p-1 text-center">{line.sortOrder}</td>
                    <td className="break-all border border-[#b9accb] p-1 font-mono">
                      {line.itemCode}
                    </td>
                    <td className="break-all border border-[#b9accb] p-1 text-[5.4pt] text-blue-700">
                      {line.imageLink ? (
                        <a href={line.imageLink} target="_blank" rel="noreferrer">
                          {line.imageLink}
                        </a>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="border border-[#b9accb] p-1 text-center">
                      {line.imageLink && !liteImages ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.imageLink}
                          alt=""
                          loading="lazy"
                          className="mx-auto h-11 w-11 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="mx-auto h-11 w-11 rounded border border-dashed border-gray-300" />
                      )}
                    </td>
                    <td className="border border-[#b9accb] p-1">{line.itemName}</td>
                    <td className="border border-[#b9accb] p-1">{line.supplierName}</td>
                    <td className="border border-[#b9accb] bg-[#dceefb] p-1 text-center">
                      {line.onHand}
                    </td>
                    <td className="border border-[#b9accb] bg-[#f5ecd8] p-1 text-right">
                      {line.itemCost}
                    </td>
                    <td className="border border-[#b9accb] bg-[#f8dce8] p-1 text-right">
                      {line.sellingPrice}
                    </td>
                    <td className="border border-[#b9accb] bg-[#fff3bf] p-1">
                      {line.wholesalePriceApproval}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pageIndex === pages.length - 1 && sectionIndex === sectionCount - 1 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-[8pt]">
              <ApprovalBox title="PREPARED BY" />
              <ApprovalBox title="CHECKED BY" />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <footer className="mt-2 flex justify-between rounded bg-[#5B2C8B] px-2 py-1 text-[6.5pt] text-white">
            <span>TFRC · Inventory Availability &amp; Price Check</span>
            <span>
              Page {sectionStart / REPORT_ROWS_PER_PAGE + pageIndex + 1} · Section{" "}
              {sectionIndex + 1}/{sectionCount}
            </span>
          </footer>
        </section>
      ))}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          html, body { background: #fff !important; }
          .print-toolbar { display: none !important; }
          .sheet { margin: 0 !important; box-shadow: none !important; page-break-after: always; }
          .sheet:last-child { page-break-after: auto; }
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
    <div className="rounded border border-[#cfc3dd] bg-[#efe8f7] p-2">
      <span className="block text-[6.5pt] font-extrabold tracking-wide text-[#5B2C8B]">
        {label}
      </span>
      <div className="mt-1 min-h-[1rem] text-[9pt] font-semibold">{value || "—"}</div>
    </div>
  );
}

function ApprovalBox({ title }: { title: string }) {
  return (
    <div className="overflow-hidden rounded border border-[#5B2C8B]">
      <div className="bg-[#5B2C8B] px-2 py-1 text-[8pt] font-extrabold tracking-wide text-white">
        {title}
      </div>
      <div className="min-h-[28mm] space-y-3 p-2">
        <p className="m-0">Name:</p>
        <p className="m-0">Signature / date:</p>
        <div className="h-14 rounded border border-dashed border-[#c4b7d6] bg-[#faf7fd]" />
      </div>
    </div>
  );
}
