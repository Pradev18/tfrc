"use client";

import { useEffect, useState } from "react";
import { CatalogueImportForm } from "@/components/admin/CatalogueImportForm";

export default function AdminImportPage() {
  const [catalogues, setCatalogues] = useState<
    Array<{ id: string; name: string; status: string; productCount: number }>
  >([]);
  const [catalogueId, setCatalogueId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCatalogues() {
      try {
        const response = await fetch("/api/admin/catalogues", { cache: "no-store" });
        const data = (await response.json()) as {
          catalogues?: Array<{
            id: string;
            name: string;
            status: string;
            productCount: number;
          }>;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Could not load catalogues");
        const items = data.catalogues ?? [];
        setCatalogues(items);
        setCatalogueId((current) => current || items[0]?.id || "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load catalogues");
      } finally {
        setLoading(false);
      }
    }
    void loadCatalogues();
  }, []);

  const selected = catalogues.find((catalogue) => catalogue.id === catalogueId);

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">Import Products</h1>
      <p className="mt-2 text-text-muted">
        Select the exact catalogue, validate the spreadsheet, then replace its product data.
      </p>

      {error && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-text-muted">Loading catalogues…</p>
      ) : catalogues.length === 0 ? (
        <p className="mt-8 text-sm text-text-muted">Create a catalogue before importing products.</p>
      ) : (
        <div className="mt-8 max-w-2xl space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Target catalogue</span>
            <select
              value={catalogueId}
              onChange={(event) => setCatalogueId(event.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
            >
              {catalogues.map((catalogue) => (
                <option key={catalogue.id} value={catalogue.id}>
                  {catalogue.name} · {catalogue.productCount} products · {catalogue.status}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <CatalogueImportForm
              key={selected.id}
              catalogueId={selected.id}
              catalogueName={selected.name}
            />
          )}
        </div>
      )}
    </div>
  );
}
