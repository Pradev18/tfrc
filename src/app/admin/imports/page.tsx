"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState("Pet Products");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleImport(preview = false) {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("department", department);
    formData.append("preview", String(preview));

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      if (!preview) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">Import Products</h1>
      <p className="mt-2 text-text-muted">
        Upload Excel (.xlsx) or CSV files. Existing products update by Product ID.
      </p>

      <div className="mt-8 max-w-xl space-y-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Department source</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option>Pet Products</option>
            <option>Households</option>
            <option>Multi Tools</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Catalogue file</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleImport(true)}
            disabled={!file || loading}
            className="btn-secondary text-sm"
          >
            Preview & Validate
          </button>
          <button
            type="button"
            onClick={() => handleImport(false)}
            disabled={!file || loading}
            className="btn-primary text-sm"
          >
            {loading ? "Importing..." : "Import"}
          </button>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        {result && (
          <div className="rounded-md bg-surface-muted p-4 text-sm">
            <p className="font-medium">Import Report</p>
            <ul className="mt-2 space-y-1 text-text-muted">
              <li>Total rows: {String(result.totalRows)}</li>
              <li>Valid: {String(result.validRows)}</li>
              <li>Invalid: {String(result.invalidRows)}</li>
              <li>Created: {String(result.created)}</li>
              <li>Updated: {String(result.updated)}</li>
              <li>Failed: {String(result.failed)}</li>
            </ul>
            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-error">Errors:</p>
                <ul className="mt-1 max-h-40 overflow-y-auto">
                  {(result.errors as Array<{ row: number; message: string }>).slice(0, 20).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
