"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toProxiedReportImageSrc, isBrowserDisplayableImageUrl } from "@/lib/report/report-image-src";
import { adminErrorMessage, readAdminJson, type AdminJson } from "@/lib/admin-fetch-json";
import { adminNotify } from "@/lib/admin-notify";

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
  lineCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  seed?: {
    status: string;
    progress: number;
    total: number;
    done: boolean;
  };
  import: {
    id: string;
    fileName: string;
    inventorySheetName: string | null;
    imageSheetName: string | null;
    iqsSheetName: string | null;
    inventoryRowCount: number;
    imageLinkCount: number;
    uniqueItemCount?: number;
    seedProgress?: number;
    duplicateItemCodes: string[];
  };
  lines: ReportLine[];
};

type DuplicateGroup = {
  itemCode: string;
  occurrences: Array<{
    sortOrder: number;
    isOriginal: boolean;
    itemName: string;
    supplierName: string;
    onHand: string;
    itemCost: string;
    sellingPrice: string;
  }>;
};

function reportFromJson(data: AdminJson): ReportDetail | null {
  return data.report && typeof data.report === "object"
    ? (data.report as ReportDetail)
    : null;
}

export function ReportEditorClient({ initialReport }: { initialReport: ReportDetail }) {
  const [report, setReport] = useState(initialReport);
  const [itemCode, setItemCode] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ itemCode: string; itemName: string }>>(
    []
  );
  const [codesOpen, setCodesOpen] = useState(false);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesHasMore, setCodesHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [pageLoading, setPageLoading] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const previewHref = useMemo(
    () => `/admin/reports/${report.id}/print`,
    [report.id]
  );

  const ingesting = report.seed && !report.seed.done;

  useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  useEffect(() => {
    if (!ingesting) return;
    let cancelled = false;
    (async () => {
      try {
        for (let i = 0; i < 2000 && !cancelled; i++) {
          const res = await fetch(
            `/api/admin/reports/imports/${report.import.id}/ingest`,
            { method: "POST", cache: "no-store" }
          );
          const data = await readAdminJson(res);
          if (!res.ok) throw new Error(adminErrorMessage(data, "Import failed"));
          if (cancelled) return;
          setReport((prev) => ({
            ...prev,
            seed: {
              status: data.done ? "READY" : "PENDING",
              progress: Number(data.progress ?? 0),
              total: Number(data.total ?? 0),
              done: Boolean(data.done),
            },
          }));
          if (data.done) {
            const refreshed = await fetch(
              `/api/admin/reports/${report.id}/lines?page=1&pageSize=${report.pageSize}`,
              { cache: "no-store" }
            );
            const body = await readAdminJson(refreshed);
            const next = reportFromJson(body);
            if (refreshed.ok && next) setReport(next);
            return;
          }
          await new Promise((r) => window.setTimeout(r, 45));
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Import failed";
          setError(message);
          adminNotify(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ingesting, report.id, report.import.id, report.pageSize]);

  const rangeLabel = useMemo(() => {
    if (report.lineCount === 0) return "0 items";
    const start = (report.page - 1) * report.pageSize + 1;
    const end = Math.min(report.page * report.pageSize, report.lineCount);
    return `${start}–${end} of ${report.lineCount} unique items`;
  }, [report.lineCount, report.page, report.pageSize]);

  const codeRequest = useRef(0);
  const codePickerRef = useRef<HTMLDivElement | null>(null);
  const addQueueRef = useRef(Promise.resolve());
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    if (!codesOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!codePickerRef.current?.contains(event.target as Node)) setCodesOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [codesOpen]);

  const loadCodes = useCallback(
    async (query: string, offset: number, append: boolean) => {
      const requestId = ++codeRequest.current;
      setCodesLoading(true);
      try {
        const res = await fetch(
          `/api/admin/reports/imports/${report.import.id}/search?q=${encodeURIComponent(query)}&offset=${offset}`,
          { cache: "no-store" }
        );
        const data = await readAdminJson(res);
        if (requestId !== codeRequest.current) return;
        if (!res.ok) return;
        const batch = (data.results ?? []) as Array<{ itemCode: string; itemName: string }>;
        setSuggestions((current) => (append ? [...current, ...batch] : batch));
        setCodesHasMore(batch.length === 40);
      } finally {
        if (requestId === codeRequest.current) setCodesLoading(false);
      }
    },
    [codeRequest, report.import.id]
  );

  useEffect(() => {
    setSuggestions([]);
    setCodesHasMore(false);
    setCodesOpen(false);
  }, [report.import.id]);

  useEffect(() => {
    if (!codesOpen) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      void loadCodes(itemCode.trim(), 0, false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [codesOpen, itemCode, loadCodes]);

  const loadPage = useCallback(
    async (page: number) => {
      setPageLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/reports/${report.id}/lines?page=${page}&pageSize=${report.pageSize}`,
          { cache: "no-store" }
        );
        const data = await readAdminJson(res);
        if (!res.ok) throw new Error(adminErrorMessage(data, "Failed to load page"));
        setReport(reportFromJson(data) ?? report);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load page");
      } finally {
        setPageLoading(false);
      }
    },
    [report.id, report.pageSize]
  );

  async function loadDuplicates() {
    if (duplicateGroups) {
      setShowDuplicates((v) => !v);
      return;
    }
    setDuplicatesLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/reports/imports/${report.import.id}/duplicates`,
        { cache: "no-store" }
      );
      const data = await readAdminJson(res);
      if (!res.ok) throw new Error(adminErrorMessage(data, "Failed to load duplicates"));
      setDuplicateGroups(
        Array.isArray(data.groups) ? (data.groups as DuplicateGroup[]) : []
      );
      setShowDuplicates(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load duplicates");
    } finally {
      setDuplicatesLoading(false);
    }
  }

  async function patchMeta(patch: Partial<ReportDetail>) {
    if (busy || saveState === "saving") return;
    setSaveState("saving");
    setError(null);
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...patch,
        page: report.page,
        pageSize: report.pageSize,
      }),
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      setError(adminErrorMessage(data, "Failed to save"));
      setSaveState("idle");
      return;
    }
    setReport(reportFromJson(data) ?? report);
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1200);
  }

  function queueAddLine(code: string) {
    const trimmed = code.trim();
    if (!trimmed || ingesting) return;
    addQueueRef.current = addQueueRef.current
      .then(async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        const current = reportRef.current;
        const res = await fetch(`/api/admin/reports/${current.id}/lines`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemCode: trimmed,
            page: current.page,
            pageSize: current.pageSize,
          }),
        });
        const data = await readAdminJson(res);
        if (!res.ok) throw new Error(adminErrorMessage(data, "Could not add item"));
        const next = reportFromJson(data);
        if (next) {
          setReport(next);
          reportRef.current = next;
        }
        setItemCode("");
        setCodesOpen(true);
        if (data.alreadyExists) {
          const msg = `“${String(data.itemCode || trimmed)}” is already on this report.`;
          setNotice(msg);
        } else {
          setNotice(`Added “${String(data.itemCode || trimmed)}”. Click another code to add more.`);
          window.setTimeout(() => setNotice(null), 1800);
        }
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Could not add item";
        setError(message);
        adminNotify(message);
      })
      .finally(() => {
        setBusy(false);
      });
  }

  async function addLine(code: string) {
    queueAddLine(code);
  }

  async function clearAllLines() {
    if (busy || ingesting || report.lineCount === 0) return;
    if (
      !window.confirm(
        `Clear all ${report.lineCount} selected item(s) from this report?\n\nThe Excel upload stays — you can pick a fresh list for the next PDF.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/reports/${report.id}/lines?all=1&pageSize=${report.pageSize}`,
        { method: "DELETE", credentials: "include", cache: "no-store" }
      );
      const data = await readAdminJson(res);
      if (!res.ok) throw new Error(adminErrorMessage(data, "Could not clear items"));
      setReport(reportFromJson(data) ?? { ...report, lines: [], lineCount: 0, page: 1 });
      setNotice("Report list cleared. Select codes for the next PDF.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not clear items";
      setError(message);
      adminNotify(message);
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
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...patch,
        page: report.page,
        pageSize: report.pageSize,
      }),
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      const message = adminErrorMessage(data, "Update failed");
      setError(message);
      adminNotify(message);
      return;
    }
    setReport(reportFromJson(data) ?? report);
  }

  async function removeLine(lineId: string) {
    if (!window.confirm("Remove this report row?")) return;
    setError(null);
    const res = await fetch(
      `/api/admin/reports/${report.id}/lines/${lineId}?page=${report.page}&pageSize=${report.pageSize}`,
      { method: "DELETE", credentials: "include", cache: "no-store" }
    );
    const data = await readAdminJson(res);
    if (!res.ok) {
      const message = adminErrorMessage(data, "Delete failed");
      setError(message);
      adminNotify(message);
      return;
    }
    setReport(reportFromJson(data) ?? report);
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
            {report.import.fileName} · {report.import.inventoryRowCount} inventory rows ·{" "}
            {report.lineCount} unique report items
            {report.import.imageLinkCount ? ` · ${report.import.imageLinkCount} image links` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            aria-disabled={Boolean(ingesting)}
            onClick={(e) => {
              if (ingesting) e.preventDefault();
            }}
          >
            Print / PDF
          </a>
        </div>
      </div>

      {ingesting && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Saving this Excel for lookup in safe batches:{" "}
          <strong>
            {(report.seed?.progress ?? 0).toLocaleString()} /{" "}
            {(report.seed?.total ?? 0).toLocaleString()}
          </strong>
          . Keep this tab open until it finishes. The item list stays empty until you add codes.
        </section>
      )}

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
        <p className="mt-2">
          Upload once (even 70k rows). Then pick only the codes you need — click a code in the
          list to add it instantly. Download PDF for those rows, add more (or clear and start
          fresh), download again. Catalogue and the public shop stay separate and should keep
          working while you do this.
        </p>
        {report.import.duplicateItemCodes.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              className="text-sm font-semibold text-amber-800 underline"
              onClick={() => void loadDuplicates()}
              disabled={duplicatesLoading}
            >
              {duplicatesLoading
                ? "Loading duplicates…"
                : showDuplicates
                  ? "Hide duplicate item codes"
                  : `Show ${report.import.duplicateItemCodes.length} duplicate item code(s)`}
            </button>
          </div>
        )}
      </section>

      {showDuplicates && duplicateGroups && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-base font-semibold text-amber-950">
            Duplicate inventory rows (excluded from PDF except originals)
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            For each code below, the first sheet-order row is kept in the report/PDF. Extra
            occurrences are listed here only.
          </p>
          <div className="mt-3 max-h-96 space-y-3 overflow-auto">
            {duplicateGroups.length === 0 ? (
              <p className="text-sm text-amber-900">No duplicate groups found.</p>
            ) : (
              duplicateGroups.map((group) => (
                <div
                  key={group.itemCode}
                  className="rounded-lg border border-amber-200 bg-white p-3 text-sm"
                >
                  <p className="font-mono font-semibold text-text">{group.itemCode}</p>
                  <ul className="mt-2 space-y-1 text-xs text-text-muted">
                    {group.occurrences.map((occ) => (
                      <li key={`${group.itemCode}-${occ.sortOrder}`}>
                        <span
                          className={
                            occ.isOriginal
                              ? "font-semibold text-emerald-700"
                              : "text-amber-800"
                          }
                        >
                          {occ.isOriginal ? "Original (used)" : "Duplicate (dropped)"}
                        </span>
                        {" · "}
                        {occ.itemName || "—"} · {occ.supplierName || "—"} · On hand{" "}
                        {occ.onHand || "—"} · Cost {occ.itemCost || "—"} · Sell{" "}
                        {occ.sellingPrice || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      )}

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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text">Add item code</h2>
            <p className="mt-1 text-sm text-text-muted">
              Click any code in the list — it is added automatically. Use{" "}
              <span className="font-semibold text-text">Add</span> only if you type a code by hand.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
            disabled={busy || Boolean(ingesting) || report.lineCount === 0}
            onClick={() => void clearAllLines()}
          >
            Clear selected items
          </button>
        </div>
        <div ref={codePickerRef} className="relative mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm"
            value={itemCode}
            placeholder="Type a code or open Codes…"
            onChange={(e) => {
              setItemCode(e.target.value);
              setCodesOpen(true);
            }}
            onFocus={() => setCodesOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setCodesOpen(false);
                void addLine(itemCode);
              }
              if (e.key === "Escape") setCodesOpen(false);
            }}
            disabled={busy || Boolean(ingesting)}
            autoComplete="off"
          />
          <button
            type="button"
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text"
            disabled={busy || Boolean(ingesting)}
            onClick={() => setCodesOpen((open) => !open)}
          >
            Codes
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || Boolean(ingesting) || !itemCode.trim()}
            onClick={() => {
              setCodesOpen(false);
              void addLine(itemCode);
            }}
          >
            {busy ? "Looking up…" : "Add"}
          </button>
          {codesOpen && (
            <ul
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-white shadow-lg sm:right-40"
              onMouseDown={(e) => e.preventDefault()}
            >
              <li className="sticky top-0 z-10 border-b border-border bg-white px-3 py-2 text-xs font-medium text-text">
                Click any code — it adds immediately (no Add button needed)
              </li>
              {suggestions.map((s) => (
                <li key={s.itemCode}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-60"
                    disabled={Boolean(ingesting)}
                    onPointerDown={(e) => {
                      // Add on pointer-down so the row cannot unmount before click fires.
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      queueAddLine(s.itemCode);
                    }}
                  >
                    <span className="font-mono font-semibold">{s.itemCode}</span>
                    {s.itemName ? (
                      <span className="text-xs text-text-muted">{s.itemName}</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {!codesLoading && suggestions.length === 0 && (
                <li className="px-3 py-2 text-sm text-text-muted">No matching codes in this upload.</li>
              )}
              {codesHasMore && (
                <li>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-muted"
                    disabled={codesLoading}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      void loadCodes(itemCode.trim(), suggestions.length, true);
                    }}
                  >
                    {codesLoading ? "Loading…" : "More codes from this upload"}
                  </button>
                </li>
              )}
              {codesLoading && suggestions.length === 0 && (
                <li className="px-3 py-2 text-sm text-text-muted">Loading codes…</li>
              )}
            </ul>
          )}
        </div>
      </section>

      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
          <p className="text-text-muted">
            {pageLoading ? "Loading…" : rangeLabel}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={pageLoading || report.page <= 1}
              onClick={() => void loadPage(report.page - 1)}
            >
              Previous
            </button>
            <span className="text-text-muted">
              Page {report.page} / {report.pageCount}
            </span>
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={pageLoading || report.page >= report.pageCount}
              onClick={() => void loadPage(report.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
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
                    No items yet. Enter an item code above and add it.
                  </td>
                </tr>
              ) : (
                report.lines.map((line) => (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">{line.sortOrder}</td>
                    <td className="px-3 py-2 font-mono text-xs">{line.itemCode}</td>
                    <td className="px-3 py-2">
                      {line.imageLink ? (
                        <div className="space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              isBrowserDisplayableImageUrl(line.imageLink)
                                ? line.imageLink
                                : toProxiedReportImageSrc(line.imageLink)
                            }
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className="h-12 w-12 rounded border border-border bg-white object-contain"
                            onError={(e) => {
                              const img = e.currentTarget;
                              const proxied = toProxiedReportImageSrc(line.imageLink);
                              if (
                                img.dataset.fallback === "1" ||
                                img.src.includes("/api/admin/reports/image-proxy")
                              ) {
                                img.style.visibility = "hidden";
                                return;
                              }
                              img.dataset.fallback = "1";
                              img.src = proxied;
                            }}
                          />
                          <a
                            href={line.imageLink}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-[100px] truncate text-[10px] text-blue-700 underline"
                            title={line.imageLink}
                          >
                            Open image
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
