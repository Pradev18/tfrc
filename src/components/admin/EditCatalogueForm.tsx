"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";

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
  const [message, setMessage] = useState("");
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
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.url as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/admin/catalogues/${catalogue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        tagline: form.tagline,
        description: form.description,
        logoUrl: form.logoUrl,
        heroHeadline: form.heroHeadline,
        status: form.status,
        sortOrder: form.sortOrder,
      }),
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
    if (res.ok && data.catalogue) {
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
      setMessage("Saved — home page card updated");
      announceSiteDataUpdate();
      router.refresh();
    } else {
      setMessage(data.error ?? "Save failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
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
        <input
          type="file"
          accept="image/*"
          className="mt-1 text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const url = await uploadImage(f);
              setForm((prev) => ({ ...prev, logoUrl: url }));
            } catch {
              setMessage("Image upload failed");
            }
          }}
        />
        {form.logoUrl && (
          <div className="relative mt-3 h-36 w-36 overflow-hidden rounded-xl border">
            <Image src={form.logoUrl} alt="" fill className="object-contain p-2" />
          </div>
        )}
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
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? "Saving…" : "Save catalogue card"}
      </button>
    </form>
  );
}
