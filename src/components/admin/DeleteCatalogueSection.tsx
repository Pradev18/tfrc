"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";

interface DeleteCatalogueSectionProps {
  catalogueId: string;
  catalogueName: string;
  productCount: number;
}

export function DeleteCatalogueSection({
  catalogueId,
  catalogueName,
  productCount,
}: DeleteCatalogueSectionProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const canDelete = confirmation.trim() === catalogueName;

  async function deleteCatalogue() {
    if (!canDelete || deleting) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/catalogues/${catalogueId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Catalogue deletion failed");
      }

      announceSiteDataUpdate();
      router.replace("/admin/catalogues");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue deletion failed");
      setDeleting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-red-200 pt-8" aria-labelledby="danger-zone-title">
      <div className="rounded-2xl border border-red-300 bg-red-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <h2 id="danger-zone-title" className="text-lg font-semibold text-red-950">
              Delete catalogue
            </h2>
            <p className="mt-1 text-sm leading-6 text-red-900">
              Permanently delete {catalogueName}, its {productCount.toLocaleString()} products,
              categories, banners, imports and catalogue inquiries. This cannot be undone.
            </p>
          </div>
        </div>

        <label className="mt-5 block text-sm font-medium text-red-950" htmlFor="delete-confirmation">
          Type <strong>{catalogueName}</strong> to confirm
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={deleting}
            autoComplete="off"
            className="min-h-11 flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200"
          />
          <button
            type="button"
            onClick={deleteCatalogue}
            disabled={!canDelete || deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {deleting ? "Deleting everything…" : "Delete permanently"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
