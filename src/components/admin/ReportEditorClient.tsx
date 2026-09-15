"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  lookupStatus: string;
  lookupWarning: string | null;
};

type ReportDetail = {
  id: string;
  title: string;
  customerName: string;
  requestedBy: string;
  shopBranch: string;
  tfrcLabel: string;
  notes: string;
  reportDate: string;
  import: {
    id: string;
    fileName: string;
    inventorySheetName: string | null;
    imageSheetName: string | null;
    iqsSheetName: string | null;
    inventoryRowCount: number;
    imageLinkCount: number;
    duplicateItemCodes: string[];
  };
  lines: ReportLine[];
};

export function ReportEditorClient({ initialReport }: { initialReport: ReportDetail }) {
  const [report, setReport] = useState(initialReport);
  const [itemCode, setItemCode] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ itemCode: string; itemName: string }>>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const previewHref = useMemo(
    () => `/api/admin/reports/${report.id}/preview`,
    [report.id]
  );

  useEffect(() => {
    const q = itemCode.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const res = await fetch(
        `/api/admin/reports/imports/${report.import.id}/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) setSuggestions(data.results ?? []);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [itemCode, report.import.id]);

  async function patchMeta(patch: Partial<ReportDetail>) {
    setSaveState("saving");
    setError(null);
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save");
      setSaveState("idle");
      return;
    }
    setReport(data.report);
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1200);
  }

  async function addLine(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCode: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setReport(data.report);
      setItemCode("");
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateLine(
    lineId: string,
    patch: { itemCode?: string; wholesalePriceApproval?: string }
  ) {
    setError(null);
    const res = await fetch(`/api/admin/reports/${report.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setReport(data.report);
  }

  async function removeLine(lineId: string) {
    if (!window.confirm("Remove this report row?")) return;
    setError(null);
    const res = await fetch(`/api/admin/reports/${report.id}/lines/${lineId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setReport(data.report);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/reports" className="text-sm text-text-muted hover:text-primary">
            ← Reports
          </Link>
          <h1 className="mt-1 text-display text-3xl text-primary">Report</h1>
          <p className="mt-1 text-sm text-text-muted">
            {report.import.fileName} · {report.import.inventoryRowCount} inventory items
            {report.import.imageLinkCount ? ` · ${report.import.imageLinkCount} image links` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Preview
          </a>
          <a
            href={`${previewHref}?print=1`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text"
          >
            Download PDF
          </a>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
        <p>
          Detected sheets:{" "}
          <span className="font-medium text-text">{report.import.inventorySheetName}</span>
          {report.import.imageSheetName ? (
            <>
              {" "}
              · <span className="font-medium text-text">{report.import.imageSheetName}</span>
            </>
          ) : null}
          {report.import.iqsSheetName ? (
            <>
              {" "}
              · <span className="font-medium text-text">{report.import.iqsSheetName}</span>
            </>
          ) : null}
        </p>
        {report.import.duplicateItemCodes.length > 0 && (
          <p className="mt-2 text-amber-700">
            Duplicate inventory item codes detected ({report.import.duplicateItemCodes.length}).
            Lookups will warn when those codes are used.
          </p>
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-text">Customer name</span>
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2"
            value={report.customerName}
            onChange={(e) => setReport({ ...report, customerName: e.target.value })}
            onBlur={(e) => patchMeta({ customerName: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-text">Requested by</span>
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2"
            value={report.requestedBy}
            onChange={(e) => setReport({ ...report, requestedBy: e.target.value })}
            onBlur={(e) => patchMeta({ requestedBy: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-text">Shop / Branch</span>
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2"
            value={report.shopBranch}
            onChange={(e) => setReport({ ...report, shopBranch: e.target.value })}
            onBlur={(e) => patchMeta({ shopBranch: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-text">Date</span>
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2"
            value={report.reportDate}
            onChange={(e) => setReport({ ...report, reportDate: e.target.value })}
            onBlur={(e) => patchMeta({ reportDate: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-semibold text-text">Notes</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-border bg-white px-3 py-2"
            value={report.notes}
            onChange={(e) => setReport({ ...report, notes: e.target.value })}
            onBlur={(e) => patchMeta({ notes: e.target.value })}
          />
        </label>
        <p className="text-xs text-text-muted md:col-span-2">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : " "}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text">Add item code</h2>
        <div className="relative mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm"
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addLine(itemCode);
              }
            }}
            disabled={busy}
          />
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || !itemCode.trim()}
            onClick={() => addLine(itemCode)}
          >
            {busy ? "Looking up…" : "Add"}
          </button>
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-white shadow-lg sm:right-28">
              {suggestions.map((s) => (
                <li key={s.itemCode}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-muted"
                    onClick={() => addLine(s.itemCode)}
                  >
                    <span className="font-mono font-semibold">{s.itemCode}</span>
                    <span className="text-xs text-text-muted">{s.itemName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-error">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#5B2C8B] text-xs text-white">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Item code</th>
                <th className="px-3 py-2">Image</th>
                <th className="px-3 py-2">Item Name</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">On Hand</th>
                <th className="px-3 py-2">Item Cost</th>
                <th className="px-3 py-2">Selling Price</th>
                <th className="px-3 py-2">Wholesale Approval</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    No report rows yet. Enter an item code to fetch inventory details.
                  </td>
                </tr>
              ) : (
                report.lines.map((line, index) => (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{line.itemCode}</td>
                    <td className="px-3 py-2">
                      {line.imageLink ? (
                        <div className="space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={line.imageLink}
                            alt=""
                            className="h-12 w-12 rounded border border-border object-contain bg-white"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <a
                            href={line.imageLink}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-[140px] truncate text-[11px] text-blue-700 underline"
                          >
                            {line.imageLink}
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{line.itemName}</td>
                    <td className="px-3 py-2">{line.supplierName}</td>
                    <td className="bg-sky-50 px-3 py-2 text-center">{line.onHand}</td>
                    <td className="bg-amber-50 px-3 py-2 text-right">{line.itemCost}</td>
                    <td className="bg-rose-50 px-3 py-2 text-right">{line.sellingPrice}</td>
                    <td className="bg-yellow-50 px-3 py-2">
                      <input
                        className="w-28 rounded border border-border bg-white px-2 py-1 text-sm"
                        value={line.wholesalePriceApproval}
                        onChange={(e) =>
                          setReport({
                            ...report,
                            lines: report.lines.map((l) =>
                              l.id === line.id
                                ? { ...l, wholesalePriceApproval: e.target.value }
                                : l
                            ),
                          })
                        }
                        onBlur={(e) =>
                          updateLine(line.id, { wholesalePriceApproval: e.target.value })
                        }
                      />
                      {line.lookupWarning && (
                        <p className="mt-1 max-w-[160px] text-[11px] text-amber-700">
                          {line.lookupWarning}
                        </p>
                      )}
                      {line.lookupStatus === "not_found" && (
                        <p className="mt-1 text-[11px] text-error">Not found</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-error hover:underline"
                        onClick={() => removeLine(line.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
