"use client";

import { useCallback, useEffect, useState } from "react";
import { CatalogueImage } from "@/components/admin/CatalogueImage";
import { brandInitial, brandAvatarTone } from "@/lib/brand-avatar";
import { adminNotify } from "@/lib/admin-notify";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";

interface CatalogueBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

/**
 * Admin brand-strip manager for one catalogue.
 * Isolated from product import/PDF — only reads/writes Brand.logoUrl.
 */
export function CatalogueBrandsPanel({
  catalogueId,
  catalogueName,
}: {
  catalogueId: string;
  catalogueName: string;
}) {
  const [brands, setBrands] = useState<CatalogueBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/brands`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load brands");
      const list = (data.brands || []) as CatalogueBrand[];
      setBrands(list);
      setDrafts(
        Object.fromEntries(list.map((brand) => [brand.id, brand.logoUrl ?? ""]))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load brands");
    } finally {
      setLoading(false);
    }
  }, [catalogueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLogo(brandId: string, logoUrl: string | null) {
    setSavingId(brandId);
    setError("");
    try {
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/brands`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, logoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setBrands((current) =>
        current.map((brand) =>
          brand.id === brandId
            ? { ...brand, logoUrl: data.brand.logoUrl ?? null }
            : brand
        )
      );
      setDrafts((current) => ({
        ...current,
        [brandId]: data.brand.logoUrl ?? "",
      }));
      announceSiteDataUpdate();
      adminNotify("Brand image saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      adminNotify(message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading brands…</p>;
  }

  if (brands.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted px-3 py-4 text-sm text-text-muted">
        No brands in {catalogueName} yet. Import Excel with a <strong>brand</strong> column
        (and optional <strong>brand_image</strong> links from R2 <code className="text-xs">BRAND_LOGO/</code>) first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Brand strip</h2>
        <p className="mt-1 text-sm text-text-muted">
          Upload logos to Cloudflare R2 folder <code className="text-xs">BRAND_LOGO/</code>,
          then put the public URL (or <code className="text-xs">BRAND_LOGO/name.png</code>) in
          Excel <code className="text-xs">brand_image</code> or paste it here. Empty → letter
          avatar — never a product photo.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {brands.map((brand) => {
          const draft = drafts[brand.id] ?? "";
          const preview = draft.trim() || brand.logoUrl;
          const tone = brandAvatarTone(brand.name);
          const dirty = draft.trim() !== (brand.logoUrl ?? "").trim();

          return (
            <li
              key={brand.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/[0.06] bg-white p-1.5">
                {preview ? (
                  <CatalogueImage
                    src={preview}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-xl font-semibold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {brandInitial(brand.name)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-semibold text-text">{brand.name}</p>
                  <p className="text-xs text-text-muted">
                    {brand.productCount} product{brand.productCount === 1 ? "" : "s"}
                  </p>
                </div>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) =>
                    setDrafts((current) => ({ ...current, [brand.id]: e.target.value }))
                  }
                  placeholder="BRAND_LOGO/name.png or https://… (empty = letter)"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingId === brand.id || !dirty}
                    onClick={() =>
                      void saveLogo(brand.id, draft.trim() ? draft.trim() : null)
                    }
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingId === brand.id ? "Saving…" : "Save logo"}
                  </button>
                  <button
                    type="button"
                    disabled={savingId === brand.id || (!brand.logoUrl && !draft)}
                    onClick={() => void saveLogo(brand.id, null)}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-muted disabled:opacity-50"
                  >
                    Use letter avatar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
