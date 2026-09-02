"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slugify";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import { CatalogueImportForm } from "@/components/admin/CatalogueImportForm";
import { CatalogueImage } from "@/components/admin/CatalogueImage";

type Step = "details" | "import" | "done";

export function CreateCatalogueWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [catalogueId, setCatalogueId] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
    logoUrl: "",
    heroHeadline: "",
  });

  async function uploadImage(imageFile: File) {
    const fd = new FormData();
    fd.append("file", imageFile);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: fd,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.url as string;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/catalogues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug || slugify(form.name),
          autoCategories: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setCatalogueId(data.catalogue.id);
      announceSiteDataUpdate();
      router.refresh();
      setStep("import");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex gap-2">
        {(["details", "import", "done"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${step === s || (["import", "done"].includes(step) && i === 0) || (step === "done" && i <= 1) ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "details" && (
        <form onSubmit={handleCreate} className="space-y-5 rounded-xl border border-border bg-surface p-6">
          <div>
            <h2 className="text-lg font-semibold text-primary">Catalogue details</h2>
            <p className="mt-1 text-sm text-text-muted">
              This appears on the home page card and store header.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              placeholder="e.g. PawMart, Pro Tools"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">URL slug</span>
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
              placeholder="pawmart"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Tagline</span>
            <input
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              placeholder="Premium Pet Care"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Hero headline</span>
            <input
              value={form.heroHeadline}
              onChange={(e) => setForm((f) => ({ ...f, heroHeadline: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              placeholder="Everything your pet deserves"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Card image</span>
            <p className="mt-1 text-xs text-text-muted">JPEG, PNG, WebP or GIF under 5 MB.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              disabled={uploading || loading}
              className="mt-2 w-full text-sm disabled:opacity-60"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setUploading(true);
                setError("");
                try {
                  const url = await uploadImage(f);
                  setForm((prev) => ({ ...prev, logoUrl: url }));
                  setError("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
            {uploading && <p className="mt-2 text-xs text-text-muted">Uploading image…</p>}
            {form.logoUrl && !uploading && (
              <p className="mt-2 text-xs text-green-700">Image ready — continue to save it with the catalogue.</p>
            )}
            {form.logoUrl && (
              <div className="relative mt-3 h-32 w-32 overflow-hidden rounded-xl border bg-white">
                <CatalogueImage src={form.logoUrl} className="h-full w-full object-contain p-2" />
              </div>
            )}
          </label>

          <button type="submit" disabled={loading || uploading} className="btn-primary w-full py-3">
            {loading ? "Creating…" : uploading ? "Wait for image…" : "Continue to product upload →"}
          </button>
        </form>
      )}

      {step === "import" && (
        <div className="space-y-4">
          <CatalogueImportForm
            catalogueId={catalogueId}
            catalogueName={form.name}
            onImported={() => {
              router.refresh();
              setStep("done");
            }}
          />
          <button
            type="button"
            onClick={() => setStep("done")}
            className="w-full text-sm text-text-muted hover:underline"
          >
            Skip import for now
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-2xl">✓</p>
          <h2 className="mt-2 text-xl font-semibold text-primary">Catalogue ready</h2>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/admin/catalogues/${catalogueId}`)}
              className="btn-primary px-6 py-2.5"
            >
              Manage catalogue
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/catalogues/new")}
              className="rounded-lg border border-border px-6 py-2.5 text-sm"
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
