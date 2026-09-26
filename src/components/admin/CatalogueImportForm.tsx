"use client";

import { useRef, useState } from "react";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import { adminNotify } from "@/lib/admin-notify";

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
  mode?: "merge" | "replace";
  applied: boolean;
  canImport: boolean;
  errors: ImportError[];
  errorSummary?: string;
  preview?: ImportPreviewRow[];
}

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

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
  onImported?: (result: ImportResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestInFlightRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [validatedSignature, setValidatedSignature] = useState("");
  const [previewedSignature, setPreviewedSignature] = useState("");
  const [replaceMissing, setReplaceMissing] = useState(false);
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  function chooseFile(nextFile: File | null) {
    setFile(null);
    setResult(null);
    setError("");
    setProgress("");
    setValidatedSignature("");
    setPreviewedSignature("");
    if (!nextFile) return;

    const extension = nextFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      const message = "Choose a Meta catalogue Excel file (.xlsx or .xls).";
      setError(message);
      adminNotify(message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (nextFile.size === 0 || nextFile.size > MAX_IMPORT_BYTES) {
      const message = "The selected file must be between 1 byte and 25 MB.";
      setError(message);
      adminNotify(message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(nextFile);
  }

  async function submit(preview: boolean) {
    if (!file || loading || requestInFlightRef.current) return;
    if (!preview && validatedSignature !== fileSignature(file)) {
      setError("Preview and validate this file before updating the catalogue.");
      return;
    }
    const mode = replaceMissing ? "replace" : "merge";
    if (!preview) {
      const confirmMessage = replaceMissing
        ? `Replace ${catalogueName} with this Excel file?\n\nProducts missing from the file will be removed from the live catalogue.`
        : `Update ${catalogueName} from this Excel file?\n\nMatching item codes will be overwritten. New item codes will be added. Other products in this catalogue stay unchanged.`;
      if (!window.confirm(confirmMessage)) return;
    }

    requestInFlightRef.current = true;
    setLoading(preview ? "preview" : "import");
    setError("");
    setProgress(
      preview
        ? "Validating spreadsheet…"
        : replaceMissing
          ? "Uploading and replacing catalogue…"
          : "Uploading and updating matched products…"
    );
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preview", String(preview));
    formData.append("mode", mode);

    try {
      if (!preview) setProgress("Importing products into database…");
      const response = await fetch(`/api/admin/catalogues/${catalogueId}/import`, {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      if (!preview) setProgress("Refreshing admin + storefront + PDF cache…");
      const data = (await response.json()) as ImportResult & { error?: string };
      if (data.error) throw new Error(data.error);

      setResult(data);
      if (preview) {
        if (data.canImport) {
          setPreviewedSignature(fileSignature(file));
          setValidatedSignature(fileSignature(file));
          setProgress(
            replaceMissing
              ? "Validation passed — ready to replace"
              : "Validation passed — ready to update by item code"
          );
        } else {
          setPreviewedSignature("");
          setValidatedSignature("");
          const message =
            data.errorSummary ||
            "Validation failed. Download the Meta template, match those columns, then choose the file again.";
          setError(message);
          adminNotify(message);
          setProgress("");
        }
      } else if (response.ok && data.applied) {
        setProgress(
          replaceMissing ? "Done — catalogue replaced" : "Done — products updated"
        );
        announceSiteDataUpdate();
        onImported?.(data);
        setValidatedSignature("");
        setPreviewedSignature("");
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setValidatedSignature("");
        setPreviewedSignature("");
        const firstIssue = data.errors?.[0];
        const message =
          data.errorSummary ||
          (firstIssue
            ? `Nothing was changed. Row ${firstIssue.row}: ${firstIssue.message}`
            : "Nothing was changed because the import failed validation.");
        setError(message);
        adminNotify(message);
        setProgress("");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Import failed";
      const stuck =
        /already running|heavy admin job|PDF is currently generating/i.test(
          message
        );
      if (stuck) {
        try {
          await fetch("/api/admin/heavy-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kinds: ["catalogue-import"] }),
            cache: "no-store",
          });
        } catch {
          /* ignore */
        }
        const clearedMessage =
          `${message}\n\nCleared a stuck import lock. Click Preview / Import once more.`;
        setError(clearedMessage);
        adminNotify(clearedMessage);
      } else {
        setError(message);
        adminNotify(message);
      }
      setProgress("");
    } finally {
      requestInFlightRef.current = false;
      setLoading(null);
    }
  }

  const canApply =
    Boolean(file) && !loading && validatedSignature === (file ? fileSignature(file) : "");
  const canPreview =
    Boolean(file) && !loading && previewedSignature !== (file ? fileSignature(file) : "");

  return (
    <div className="relative space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/85 backdrop-blur-[1px]">
          <div className="mx-4 max-w-sm rounded-xl border border-border bg-surface px-5 py-4 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-primary">
              {loading === "preview"
                ? "Validating file"
                : replaceMissing
                  ? "Replacing catalogue"
                  : "Updating catalogue"}
            </p>
            <p className="mt-1 text-xs text-text-muted">{progress || "Please wait…"}</p>
            <p className="mt-2 text-xs text-text-muted">Do not close this page.</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-primary">Update {catalogueName} from Excel</h3>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Upload any Excel rows for this catalogue. Matching{" "}
          <strong>item codes</strong> (<code className="text-xs">id</code> column) overwrite
          existing products everywhere (shop + PDF). New item codes are added. Other products in
          this catalogue stay unless you enable full replace below.
        </p>
        <a
          href="/api/admin/catalogues/import-template"
          download="TFRC-catalogue-template.xlsx"
          className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-muted"
        >
          Download Excel template (.xlsx)
        </a>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Meta catalogue Excel file</span>
        <span className="mb-2 block text-xs text-text-muted">
          Required columns: id (item code), title, price, image_link. Optional: item_no /
          No (catalogue sequence), description, brand, google_product_category, sale_price,
          availability, quantity_to_sell_on_facebook. Empty rows ignored. .xlsx / .xls up to 25 MB.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          disabled={Boolean(loading)}
          className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium disabled:opacity-60"
        />
      </label>

      {file && (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-text-muted">
          Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}

      <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-950">
        <input
          type="checkbox"
          checked={replaceMissing}
          onChange={(event) => {
            setReplaceMissing(event.target.checked);
            setValidatedSignature("");
            setPreviewedSignature("");
          }}
          disabled={Boolean(loading)}
          className="mt-1"
        />
        <span>
          <strong>Full replace</strong> — also remove products in this catalogue that are{" "}
          <em>not</em> in the Excel file. Leave unchecked to only update/add by item code.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!canPreview}
          className="btn-secondary min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "preview"
            ? "Validating…"
            : file && previewedSignature === fileSignature(file)
              ? "1. Preview complete ✓"
              : "1. Preview & validate"}
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!canApply}
          className="btn-primary min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "import"
            ? replaceMissing
              ? "Replacing… please wait"
              : "Updating… please wait"
            : replaceMissing
              ? "2. Replace catalogue"
              : "2. Update by item code"}
        </button>
      </div>

      {!canApply && file && !loading && validatedSignature !== fileSignature(file) && (
        <p className="text-xs text-amber-700">
          Preview & validate must succeed before update unlocks.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`rounded-lg p-4 text-sm ${
            result.applied ? "bg-green-50 text-green-900" : "bg-surface-muted text-text"
          }`}
        >
          <p className="font-semibold">
            {result.applied
              ? result.mode === "replace"
                ? `Replaced successfully — created ${result.created}, updated ${result.updated}, archived ${result.archived}`
                : `Updated successfully — created ${result.created}, updated ${result.updated} (other products kept)`
              : result.canImport
                ? replaceMissing
                  ? "File validated — click Replace catalogue"
                  : "File validated — click Update by item code"
                : "Validation report"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <span>Total rows: {result.totalRows}</span>
            <span>Valid: {result.validRows}</span>
            <span>Invalid: {result.invalidRows}</span>
            <span>Will create / created: {result.created}</span>
            <span>Will update / updated: {result.updated}</span>
            <span>Archived: {result.archived}</span>
          </div>

          {result.preview && result.preview.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">Item code</th>
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

          {(result.errorSummary || result.errors.length > 0) && (
            <div className="mt-4 space-y-2">
              {result.errorSummary && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
                  {result.errorSummary}
                </p>
              )}
              {result.errors.length > 0 && (
                <ul className="max-h-52 space-y-1 overflow-y-auto text-xs text-red-800">
                  {result.errors.slice(0, 20).map((item, index) => (
                    <li key={`${item.row}-${index}`}>
                      Row {item.row}: {item.message}
                    </li>
                  ))}
                  {result.errors.length > 20 && (
                    <li>…and {result.errors.length - 20} more template errors</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
