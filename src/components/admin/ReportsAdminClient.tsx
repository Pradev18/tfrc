"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    createdAt: string;
  };
};

async function seedUntilReady(
  reportId: string,
  onProgress: (progress: number, total: number) => void
) {
  // ~66k / 250 ≈ 265 requests; each stays under Cloudflare/Hostinger limits.
  for (let i = 0; i < 2000; i++) {
    const res = await fetch(`/api/admin/reports/${reportId}/seed`, {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Seeding failed");
    onProgress(data.progress ?? 0, data.total ?? 0);
    if (data.done) return;
  }
  throw new Error("Seeding timed out. Re-open the report to continue.");
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

  async function refresh() {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setReports(data.reports ?? []);
  }

  async function onUpload(file: File | null, inputEl?: HTMLInputElement | null) {
    if (!file || uploading) return;
    setError(null);
    setUploading(true);
    setProgressLabel("Uploading & parsing workbook…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (data.needsSeed && data.reportId) {
        setProgressLabel("Building unique report rows (safe batches)…");
        await seedUntilReady(data.reportId, (progress, total) => {
          setProgressLabel(`Seeding report rows ${progress.toLocaleString()} / ${total.toLocaleString()}…`);
        });
      }

      router.push(`/admin/reports/${data.reportId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      await refresh();
    } finally {
      setUploading(false);
      setProgressLabel(null);
      if (inputEl) inputEl.value = "";
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function resumeSeed(reportId: string) {
    if (uploading) return;
    setUploading(true);
    setError(null);
    try {
      await seedUntilReady(reportId, (progress, total) => {
        setProgressLabel(`Seeding report rows ${progress.toLocaleString()} / ${total.toLocaleString()}…`);
      });
      await refresh();
      router.push(`/admin/reports/${reportId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seeding failed");
      await refresh();
    } finally {
      setUploading(false);
      setProgressLabel(null);
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
          Upload the Office Forms workbook. Unique inventory codes are seeded in small
          batches (Hostinger/Cloudflare safe). Duplicates are listed separately and omitted
          from the PDF. Print uses sectioned pages so the server never builds a huge HTML
          file.
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
          Supported: .xlsx / .xls · Max 30 MB · No external PDF service required
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
                  return (
                    <tr key={report.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{report.title}</p>
                        <p className="text-xs text-text-muted">
                          {report.import.inventorySheetName || "Inventory"} ·{" "}
                          {report.import.inventoryRowCount} source items
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{report.import.fileName}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(report.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {pending
                          ? `${report.import.seedProgress ?? 0} / ${report.import.uniqueItemCount ?? "?"}`
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
                              onClick={() => void resumeSeed(report.id)}
                            >
                              Resume seed
                            </button>
                          ) : (
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
