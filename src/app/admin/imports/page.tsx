"use client";

import { useEffect, useState } from "react";
import { CatalogueImportForm } from "@/components/admin/CatalogueImportForm";
import { UiSelect } from "@/components/ui/UiSelect";

type CatalogueOption = {
  id: string;
  name: string;
  status: string;
  productCount: number;
};

export default function AdminImportPage() {
  const [catalogues, setCatalogues] = useState<CatalogueOption[]>([]);
  const [catalogueId, setCatalogueId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCatalogues(preferredId?: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/catalogues?_=${Date.now()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        catalogues?: CatalogueOption[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not load catalogues");
      const items = data.catalogues ?? [];
      setCatalogues(items);
      setCatalogueId((current) => preferredId || current || items[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load catalogues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
      {message && (
        <p className="mt-6 rounded-md bg-green-50 p-3 text-sm text-green-800">{message}</p>
      )}

      {loading && catalogues.length === 0 ? (
        <p className="mt-8 text-sm text-text-muted">Loading catalogues…</p>
      ) : catalogues.length === 0 ? (
        <p className="mt-8 text-sm text-text-muted">Create a catalogue before importing products.</p>
      ) : (
        <div className="mt-8 max-w-2xl space-y-5">
          <div className="block">
            <span className="mb-1 block text-sm font-medium">Target catalogue</span>
            <UiSelect
              value={catalogueId}
              onValueChange={(value) => {
                setCatalogueId(value);
                setMessage("");
              }}
              ariaLabel="Target catalogue"
              options={catalogues.map((catalogue) => ({
                value: catalogue.id,
                label: `${catalogue.name} · ${catalogue.productCount} products · ${catalogue.status}`,
              }))}
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
            />
          </div>

          {selected && (
            <CatalogueImportForm
              key={selected.id}
              catalogueId={selected.id}
              catalogueName={selected.name}
              onImported={(result) => {
                setMessage(
                  `Replaced ${selected.name} — ${result.validRows} live products now`
                );
                void loadCatalogues(selected.id);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
