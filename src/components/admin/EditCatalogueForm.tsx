"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import { CatalogueImage } from "@/components/admin/CatalogueImage";

interface EditCatalogueFormProps {
  catalogue: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    status: string;
    sortOrder: number;
    config: { heroHeadline?: string };
  };
}

export function EditCatalogueForm({ catalogue }: EditCatalogueFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: catalogue.name,
    slug: catalogue.slug,
    tagline: catalogue.tagline ?? "",
    description: catalogue.description ?? "",
    logoUrl: catalogue.logoUrl ?? "",
    heroHeadline: catalogue.config.heroHeadline ?? "",
    status: catalogue.status,
    sortOrder: catalogue.sortOrder,
  });

  async function uploadImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: fd,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url as string;
  }

  async function saveCatalogue(nextForm: typeof form, successMessage: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/catalogues/${catalogue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextForm.name,
        slug: nextForm.slug,
        tagline: nextForm.tagline,
        description: nextForm.description,
        logoUrl: nextForm.logoUrl,
        heroHeadline: nextForm.heroHeadline,
        status: nextForm.status,
        sortOrder: nextForm.sortOrder,
      }),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      catalogue?: {
        name: string;
        slug: string;
        tagline: string | null;
        description: string | null;
        logoUrl: string | null;
        status: string;
        sortOrder: number;
      };
      error?: string;
    };
    setLoading(false);
    if (!res.ok || !data.catalogue) {
      setError(data.error ?? "Save failed");
      return false;
    }

    setForm((current) => ({
      ...current,
      name: data.catalogue!.name,
      slug: data.catalogue!.slug,
      tagline: data.catalogue!.tagline ?? "",
      description: data.catalogue!.description ?? "",
      logoUrl: data.catalogue!.logoUrl ?? "",
      status: data.catalogue!.status,
      sortOrder: data.catalogue!.sortOrder,
    }));
    setMessage(successMessage);
    announceSiteDataUpdate();
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveCatalogue(form, "Saved — catalogue card updated everywhere");
  }

  async function handleImageChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("Uploading image…");
    try {
      const url = await uploadImage(file);
      const nextForm = { ...form, logoUrl: url };
      setForm(nextForm);
      setMessage("Image uploaded — saving catalogue…");
      await saveCatalogue(nextForm, "Image applied — admin + home page updated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed");
      setMessage("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <label className="block">
        <span className="text-sm font-medium">Display name</span>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">URL slug</span>
        <input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Tagline (home card)</span>
        <input
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Hero headline (store page)</span>
        <input
          value={form.heroHeadline}
          onChange={(e) => setForm((f) => ({ ...f, heroHeadline: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Card image</span>
        <p className="mt-1 text-xs text-text-muted">
          Choose a JPEG/PNG/WebP/GIF under 5 MB. It saves automatically after upload.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
          disabled={uploading || loading}
          className="mt-2 text-sm disabled:opacity-60"
          onChange={(e) => {
            void handleImageChange(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {form.logoUrl && (
          <div className="relative mt-3 h-36 w-36 overflow-hidden rounded-xl border bg-white">
            <CatalogueImage src={form.logoUrl} className="h-full w-full object-cover" />
          </div>
        )}
        {uploading && <p className="mt-2 text-xs text-text-muted">Uploading & applying image…</p>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          >
            <option value="ACTIVE">Active (visible)</option>
            <option value="INACTIVE">Hidden</option>
            <option value="COMING_SOON">Coming soon</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Sort order</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) =>
              setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))
            }
            className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
      </div>

      <button type="submit" disabled={loading || uploading} className="btn-primary w-full py-3">
        {loading ? "Saving…" : "Save catalogue card"}
      </button>
    </form>
  );
}
