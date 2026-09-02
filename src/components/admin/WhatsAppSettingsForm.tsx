"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import {
  buildCartWhatsAppMessage,
  type CartWhatsAppItem,
  type WhatsAppSettings,
} from "@/lib/whatsapp";

const SAMPLE_ITEMS: CartWhatsAppItem[] = [
  {
    name: "Foldable Pet Carrier",
    productId: "110011585",
    slug: "foldable-pet-carrier",
    regularPrice: 68.8,
    displayPrice: 68.8,
    currency: "QAR",
    environmentSlug: "pawmart",
    environmentName: "PawMart Qatar",
  },
  {
    name: "Pet Bath Brush",
    productId: "110011584",
    slug: "pet-bath-brush",
    regularPrice: 12,
    displayPrice: 12,
    currency: "QAR",
    environmentSlug: "pawmart",
    environmentName: "PawMart Qatar",
  },
];

export function WhatsAppSettingsForm({
  initialSettings,
  siteUrl,
}: {
  initialSettings: WhatsAppSettings;
  siteUrl: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const preview = useMemo(
    () => buildCartWhatsAppMessage(settings, SAMPLE_ITEMS, siteUrl),
    [settings, siteUrl]
  );

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/settings/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as {
        settings?: WhatsAppSettings;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not save settings");
      }

      setSettings(data.settings);
      setMessage("Saved. Storefront WhatsApp buttons and open tabs are updating now.");
      announceSiteDataUpdate();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="mt-8 max-w-2xl space-y-5">
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`rounded-md px-4 py-3 text-sm ${
            isError ? "bg-red-50 text-red-800" : "bg-success/10 text-success"
          }`}
        >
          {message}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">WhatsApp Number</span>
        <input
          value={settings.phoneNumber}
          onChange={(event) =>
            setSettings((current) => ({ ...current, phoneNumber: event.target.value }))
          }
          inputMode="tel"
          placeholder="97455049229"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          required
        />
        <span className="mt-1 block text-xs text-text-muted">
          Include the country code without the + sign.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Default Greeting</span>
        <input
          value={settings.defaultGreeting}
          onChange={(event) =>
            setSettings((current) => ({ ...current, defaultGreeting: event.target.value }))
          }
          maxLength={500}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Product Format</span>
        <textarea
          value={settings.productTemplate}
          onChange={(event) =>
            setSettings((current) => ({ ...current, productTemplate: event.target.value }))
          }
          rows={5}
          maxLength={2000}
          className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
          required
        />
        <span className="mt-1 block text-xs text-text-muted">
          Available fields: {"{{index}}"}, {"{{name}}"}, {"{{price}}"}, {"{{productId}}"},{" "}
          {"{{link}}"}, {"{{catalogue}}"}
        </span>
      </label>

      <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-text-muted">
        <p className="font-medium text-text">Live order-message preview</p>
        <p className="mt-1 text-xs">
          This preview changes immediately while you type and matches customer cart orders.
        </p>
        <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed text-text">
          {preview}
        </pre>
      </div>

      <button type="submit" disabled={saving} className="btn-primary min-h-11 px-6 text-sm">
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
