"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminErrorMessage,
  readAdminJson,
} from "@/lib/admin-fetch-json";

type ReportListItem = {
  id: string;
  title: string;
  customerName: string;
  reportDate: string;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  import: {
    id: string;
    fileName: string;
    status: string;
    inventoryRowCount: number;
    imageLinkCount: number;
    uniqueItemCount?: number;
    seedProgress?: number;
    inventorySheetName: string | null;
    imageSheetName: string | null;
    iqsSheetName: string | null;
    errorMessage?: string | null;
    createdAt: string;
  };
};

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
/** Keep each JSON chunk small so Hostinger/Cloudflare WAF does not 403 the upload. */
const UPLOAD_CHUNK_BYTES = 256 * 1024;

function sanitizeClientExcelName(fileName: string): string {
  const raw = String(fileName || "workbook.xlsx").trim() || "workbook.xlsx";
  const parts = raw.split(".");
  const ext = (parts.length > 1 ? parts.pop() : "xlsx")!.toLowerCase();
  const safeExt = ext === "xls" || ext === "xlsx" ? ext : "xlsx";
  const base = parts
    .join(".")
    .replace(/['"`<>\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return `${base || "workbook"}.${safeExt}`;
}

function validateExcelFile(file: File): string | null {
  const name = file.name || "workbook";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "xlsx" && ext !== "xls") {
    return `Excel problem in “${name}”: only .xlsx or .xls files are accepted.`;
  }
  if (file.size <= 0) {
    return `Excel problem in “${name}”: the file is empty.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Excel problem in “${name}”: file is too large (${Math.round(file.size / (1024 * 1024))} MB). Maximum is 30 MB.`;
  }
  return null;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function ReportsAdminClient({
  initialReports,
}: {
  initialReports: ReportListItem[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function ingestUntilReady(
    importId: string,
    onProgress: (progress: number, total: number, phase: string) => void
  ) {
    let transientFails = 0;
    for (let i = 0; i < 2500; i++) {
      try {
        const res = await fetch(`/api/admin/reports/imports/${importId}/ingest`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const data = await readAdminJson(res, "Import failed");
        if (!res.ok) {
          const message = adminErrorMessage(data, "Import failed");
          const transient =
            res.status >= 500 ||
            message.toLowerCase().includes("timed out") ||
            message.toLowerCase().includes("server error");
          if (transient && transientFails < 8) {
            transientFails += 1;
            setProgressLabel(
              `Server busy — retrying import (${transientFails}/8)…`
            );
            await new Promise((r) => window.setTimeout(r, 1200 * transientFails));
            continue;
          }
          throw new Error(message);
        }
        transientFails = 0;
        onProgress(
          Number(data.progress ?? 0),
          Number(data.total ?? 0),
          String(data.phase || "")
        );
        if (data.done) return;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Import failed";
        const excelProblem = message.startsWith("Excel problem");
        if (!excelProblem && transientFails < 8) {
          transientFails += 1;
          setProgressLabel(
            `Connection issue — retrying import (${transientFails}/8)…`
          );
          await new Promise((r) => window.setTimeout(r, 1200 * transientFails));
          continue;
        }
        throw e instanceof Error ? e : new Error(message);
      }
    }
    throw new Error("Import timed out. Re-open Reports and press Resume import.");
  }

  async function refresh() {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    const data = await readAdminJson(res, "Failed to refresh reports");
    if (res.ok) setReports((data.reports as ReportListItem[]) ?? []);
  }

  async function uploadWorkbookChunked(file: File) {
    const safeName = sanitizeClientExcelName(file.name);
    const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
    setProgressLabel(`Preparing upload (0/${totalChunks})…`);

    const initRes = await fetch("/api/admin/reports/upload", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "init",
        fileName: safeName,
        fileSize: file.size,
        totalChunks,
      }),
    });
    const initData = await readAdminJson(initRes, "Upload failed");
    if (!initRes.ok) throw new Error(adminErrorMessage(initData, "Upload failed"));
    const uploadId = String(initData.uploadId || "");
    if (!uploadId) throw new Error("Upload session was not created. Retry.");

    for (let index = 0; index < totalChunks; index++) {
      const start = index * UPLOAD_CHUNK_BYTES;
      const end = Math.min(file.size, start + UPLOAD_CHUNK_BYTES);
      const slice = await file.slice(start, end).arrayBuffer();
      setProgressLabel(
        `Uploading workbook ${index + 1}/${totalChunks} (${Math.round(((index + 1) / totalChunks) * 100)}%)…`
      );

      let attempt = 0;
      for (;;) {
        attempt += 1;
        const chunkRes = await fetch("/api/admin/reports/upload", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "chunk",
            uploadId,
            index,
            chunkBase64: bufferToBase64(slice),
          }),
        });
        const chunkData = await readAdminJson(chunkRes, "Upload failed");
        if (chunkRes.ok) break;
        const message = adminErrorMessage(chunkData, "Upload failed");
        if (attempt >= 4 || chunkRes.status === 401 || message.startsWith("Excel problem")) {
          throw new Error(message);
        }
        await new Promise((r) => window.setTimeout(r, 800 * attempt));
      }
    }

    setProgressLabel("Parsing workbook…");
    const completeRes = await fetch("/api/admin/reports/upload", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", uploadId }),
    });
    const completeData = await readAdminJson(completeRes, "Upload failed");
    if (!completeRes.ok) throw new Error(adminErrorMessage(completeData, "Upload failed"));
    return completeData;
  }

  async function onUpload(file: File | null, inputEl?: HTMLInputElement | null) {
    if (!file || uploading) return;
    setError(null);
    const localError = validateExcelFile(file);
    if (localError) {
      setError(localError);
      if (inputEl) inputEl.value = "";
      return;
    }
    if (typeof window !== "undefined" && window.location.hostname === "vitanovaservices.com") {
      setError(
        "Open admin on https://www.vitanovaservices.com/admin/reports (with www), sign in again, then upload."
      );
      if (inputEl) inputEl.value = "";
      return;
    }
    setUploading(true);
    setProgressLabel("Uploading workbook…");
    try {
      const data = await uploadWorkbookChunked(file);

      if (data.needsIngest && data.importId) {
        setProgressLabel("Saving inventory for lookup…");
        await ingestUntilReady(String(data.importId), (progress, total, phase) => {
          const label = phase === "images" ? "image links" : "inventory rows";
          setProgressLabel(
            `Saving ${label} ${progress.toLocaleString()} / ${total.toLocaleString()}…`
          );
        });
      }

      router.push(`/admin/reports/${String(data.reportId)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      await refresh().catch(() => null);
    } finally {
      setUploading(false);
      setProgressLabel(null);
      if (inputEl) inputEl.value = "";
    }
  }

  async function resumeImport(importId: string, reportId: string) {
    if (uploading) return;
    setUploading(true);
    setError(null);
    try {
      setProgressLabel("Resuming import…");
      await ingestUntilReady(importId, (progress, total, phase) => {
        const label = phase === "images" ? "image links" : "inventory rows";
        setProgressLabel(
          `Saving ${label} ${progress.toLocaleString()} / ${total.toLocaleString()}…`
        );
      });
      await refresh();
      router.push(`/admin/reports/${reportId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      await refresh().catch(() => null);
    } finally {
      setUploading(false);
      setProgressLabel(null);
    }
  }

  async function onDelete(id: string) {
    if (uploading || deletingId) return;
    if (!window.confirm("Delete this report and its imported source data for this upload?")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
      const data = await readAdminJson(res, "Delete failed");
      if (!res.ok) throw new Error(adminErrorMessage(data, "Delete failed"));
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-display text-3xl text-primary">Report</h1>
        <p className="mt-1 text-sm text-text-muted">
          Inventory Availability &amp; Price Check
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-text">Upload Excel File</h2>
        <p className="mt-1 text-sm text-text-muted">
          Upload the Office Forms workbook. The report starts empty. Search an item code
          and add only the products you want. Duplicates stay listed separately and are
          omitted from the PDF.
        </p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-muted px-4 py-3 text-sm font-medium text-text hover:border-primary">
          <span>
            {uploading
              ? progressLabel || "Working…"
              : "Choose Excel File"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            disabled={uploading}
            onChange={(e) => onUpload(e.target.files?.[0] ?? null, e.currentTarget)}
          />
        </label>
        <p className="mt-2 text-xs text-text-muted">
          Supported: .xlsx / .xls · Max 30 MB · Large files upload in safe chunks
          (use https://www.vitanovaservices.com — with www)
        </p>
        {progressLabel && (
          <p className="mt-3 text-sm font-medium text-primary">{progressLabel}</p>
        )}
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-text">Reports</h2>
        </div>
        {reports.length === 0 ? (
          <p className="px-5 py-8 text-sm text-text-muted">No reports yet. Upload a workbook to begin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Report</th>
                  <th className="px-4 py-3 font-semibold">Source File</th>
                  <th className="px-4 py-3 font-semibold">Imported</th>
                  <th className="px-4 py-3 font-semibold">Rows</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const pending = report.import.status === "PENDING";
                  const failed = report.import.status === "FAILED";
                  return (
                    <tr key={report.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{report.title}</p>
                        <p className="text-xs text-text-muted">
                          {report.import.inventorySheetName || "Inventory"} ·{" "}
                          {report.import.inventoryRowCount} source items
                        </p>
                        {failed && report.import.errorMessage ? (
                          <p className="mt-1 text-xs text-error">{report.import.errorMessage}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{report.import.fileName}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(report.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {pending
                          ? `${report.import.seedProgress ?? 0} / ${
                              (report.import.inventoryRowCount ?? 0) +
                              (report.import.imageLinkCount ?? 0)
                            }`
                          : report.lineCount}
                      </td>
                      <td className="px-4 py-3">{report.import.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {pending ? (
                            <button
                              type="button"
                              className="text-primary hover:underline disabled:opacity-50"
                              disabled={uploading}
                              onClick={() =>
                                void resumeImport(report.import.id, report.id)
                              }
                            >
                              Resume import
                            </button>
                          ) : failed ? null : (
                            <>
                              <Link
                                href={`/admin/reports/${report.id}`}
                                className="text-primary hover:underline"
                              >
                                Edit
                              </Link>
                              <Link
                                href={`/admin/reports/${report.id}/print`}
                                className="text-primary hover:underline"
                                target="_blank"
                              >
                                Print / PDF
                              </Link>
                            </>
                          )}
                          <button
                            type="button"
                            className="text-error hover:underline disabled:opacity-50"
                            disabled={deletingId === report.id || uploading}
                            onClick={() => onDelete(report.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
