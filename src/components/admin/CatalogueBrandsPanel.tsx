"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Link2, Trash2 } from "lucide-react";
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
 * Admin brand manager: click card → pick device photo → R2 brand_logo/.
 * Also supports Excel brand_image URLs. Isolated from product/PDF import.
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
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [showUrlFor, setShowUrlFor] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

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

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [previews]);

  function applyBrand(brandId: string, logoUrl: string | null) {
    setBrands((current) =>
      current.map((brand) =>
        brand.id === brandId ? { ...brand, logoUrl } : brand
      )
    );
    setDrafts((current) => ({ ...current, [brandId]: logoUrl ?? "" }));
    setPreviews((current) => {
      const prev = current[brandId];
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      const next = { ...current };
      delete next[brandId];
      return next;
    });
    announceSiteDataUpdate();
    window.dispatchEvent(new Event("tfrc-brands-updated"));
  }

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
      applyBrand(brandId, data.brand.logoUrl ?? null);
      adminNotify(logoUrl ? "Brand image saved" : "Using letter avatar");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      adminNotify(message);
    } finally {
      setSavingId(null);
    }
  }

  async function uploadFromDevice(brand: CatalogueBrand, file: File) {
    if (!file.type.startsWith("image/")) {
      adminNotify("Choose a JPEG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      adminNotify("Image must be under 5 MB");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviews((current) => {
      const prev = current[brand.id];
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return { ...current, [brand.id]: localUrl };
    });

    setSavingId(brand.id);
    setError("");
    try {
      const body = new FormData();
      body.set("brandId", brand.id);
      body.set("file", file);
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/brands`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      applyBrand(brand.id, data.brand.logoUrl ?? data.url ?? null);
      adminNotify(`Uploaded ${brand.name} logo to brand_logo`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      adminNotify(message);
      setPreviews((current) => {
        const prev = current[brand.id];
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        const next = { ...current };
        delete next[brand.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  function onFilePicked(brand: CatalogueBrand, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    void uploadFromDevice(brand, file);
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading brands…</p>;
  }

  if (brands.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted px-3 py-4 text-sm text-text-muted">
        No brands in {catalogueName} yet. Import Excel with a <strong>brand</strong> column
        first. Then click a card here to upload a logo from your device (or add{" "}
        <code className="text-xs">brand_image</code> links in Excel).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Brand strip</h2>
        <p className="mt-1 text-sm text-text-muted">
          Click a brand card to choose a photo from your device — it uploads to Cloudflare{" "}
          <code className="text-xs">brand_logo/</code>. Or use Excel{" "}
          <code className="text-xs">brand_image</code>. No logo → letter on the card. No brand
          names in the catalogue → strip hidden on store and Products.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => {
          const draft = drafts[brand.id] ?? "";
          const preview = previews[brand.id] || draft.trim() || brand.logoUrl;
          const tone = brandAvatarTone(brand.name);
          const busy = savingId === brand.id;
          const dirty = draft.trim() !== (brand.logoUrl ?? "").trim();
          const showUrl = showUrlFor[brand.id];

          return (
            <li
              key={brand.id}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                onFilePicked(brand, e.dataTransfer.files);
              }}
            >
              <input
                ref={(el) => {
                  fileInputs.current[brand.id] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="sr-only"
                onChange={(e) => {
                  onFilePicked(brand, e.target.files);
                  e.target.value = "";
                }}
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputs.current[brand.id]?.click()}
                className="group relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-2 transition hover:border-primary/40 disabled:opacity-60"
                aria-label={`Upload logo for ${brand.name}`}
                title="Click to choose a photo from your device"
              >
                {preview ? (
                  <CatalogueImage
                    src={preview}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-3xl font-semibold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {brandInitial(brand.name)}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                </span>
                {busy ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs font-semibold text-primary">
                    Uploading…
                  </span>
                ) : null}
              </button>

              <div className="mt-3 text-center">
                <p className="font-semibold text-text">{brand.name}</p>
                <p className="text-xs text-text-muted">
                  {brand.productCount} product{brand.productCount === 1 ? "" : "s"}
                  {brand.logoUrl ? " · logo set" : " · letter"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputs.current[brand.id]?.click()}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {brand.logoUrl ? "Replace" : "Upload"}
                </button>
                <button
                  type="button"
                  disabled={busy || (!brand.logoUrl && !draft && !previews[brand.id])}
                  onClick={() => void saveLogo(brand.id, null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text-muted disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Letter
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setShowUrlFor((current) => ({
                      ...current,
                      [brand.id]: !current[brand.id],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text-muted"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  URL
                </button>
              </div>

              {showUrl ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [brand.id]: e.target.value,
                      }))
                    }
                    placeholder="https://… or brand_logo/name.png"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() =>
                      void saveLogo(brand.id, draft.trim() ? draft.trim() : null)
                    }
                    className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save URL
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
