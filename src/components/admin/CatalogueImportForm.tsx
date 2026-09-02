"use client";

import { useRef, useState } from "react";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";

interface ImportError {
  row: number;
  message: string;
}

interface ImportPreviewRow {
  id: string;
  title: string;
  price: number;
}

interface ImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  created: number;
  updated: number;
  archived: number;
  failed: number;
  applied: boolean;
  canImport: boolean;
  errors: ImportError[];
  preview?: ImportPreviewRow[];
}

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function CatalogueImportForm({
  catalogueId,
  catalogueName,
  onImported,
}: {
  catalogueId: string;
  catalogueName: string;
  onImported?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validatedSignature, setValidatedSignature] = useState("");
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  function chooseFile(nextFile: File | null) {
    setFile(null);
    setResult(null);
    setError("");
    setValidatedSignature("");
    if (!nextFile) return;

    const extension = nextFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      setError("Choose an Excel (.xlsx, .xls) or CSV file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (nextFile.size === 0 || nextFile.size > MAX_IMPORT_BYTES) {
      setError("The selected file must be between 1 byte and 25 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(nextFile);
  }

  async function submit(preview: boolean) {
    if (!file || loading) return;
    if (!preview && validatedSignature !== fileSignature(file)) {
      setError("Preview and validate this file before replacing the catalogue.");
      return;
    }
    if (
      !preview &&
      !window.confirm(
        `Replace ${catalogueName} with this Excel file? Products missing from the file will be archived.`
      )
    ) {
      return;
    }

    setLoading(preview ? "preview" : "import");
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preview", String(preview));

    try {
      const response = await fetch(`/api/admin/catalogues/${catalogueId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (data.error) throw new Error(data.error);

      setResult(data);
      if (preview) {
        if (data.canImport) {
          setValidatedSignature(fileSignature(file));
        } else {
          setError("Validation failed. Correct the listed spreadsheet rows and choose the file again.");
        }
      } else if (response.ok && data.applied) {
        announceSiteDataUpdate();
        onImported?.();
        setValidatedSignature("");
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError("Nothing was changed because the import failed validation.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h3 className="font-semibold text-primary">Replace {catalogueName} from Excel</h3>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Preview first. A successful import creates new products, updates matching product IDs,
          restores previously archived matches, and archives products missing from the new file.
          If any row is invalid, no catalogue products are changed.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Catalogue file</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          disabled={Boolean(loading)}
          className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </label>

      {file && (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-text-muted">
          Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!file || Boolean(loading)}
          className="btn-secondary min-h-11 text-sm"
        >
          {loading === "preview" ? "Validating…" : "Preview & validate"}
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={
            !file || Boolean(loading) || validatedSignature !== (file ? fileSignature(file) : "")
          }
          className="btn-primary min-h-11 text-sm"
        >
          {loading === "import" ? "Replacing catalogue…" : "Replace catalogue"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-lg bg-surface-muted p-4 text-sm">
          <p className="font-semibold text-primary">
            {result.applied
              ? "Import completed and storefront update sent"
              : result.canImport
                ? "File validated — ready to replace"
                : "Validation report"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <span>Total: {result.totalRows}</span>
            <span>Valid: {result.validRows}</span>
            <span>Invalid: {result.invalidRows}</span>
            <span>Created: {result.created}</span>
            <span>Updated: {result.updated}</span>
            <span>Archived: {result.archived}</span>
          </div>

          {result.preview && result.preview.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">Product ID</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.slice(0, 10).map((row) => (
                    <tr key={`${row.id}-${row.title}`} className="border-b border-border/60">
                      <td className="py-2 pr-3">{row.id}</td>
                      <td className="py-2 pr-3">{row.title}</td>
                      <td className="py-2">QAR {row.price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.errors.length > 0 && (
            <ul className="mt-4 max-h-52 space-y-1 overflow-y-auto text-xs text-red-800">
              {result.errors.slice(0, 50).map((item, index) => (
                <li key={`${item.row}-${index}`}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
