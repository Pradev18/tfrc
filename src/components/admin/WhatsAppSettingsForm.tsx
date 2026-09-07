"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { announceSiteDataUpdate } from "@/components/LiveDataRefresh";
import {
  buildCartWhatsAppMessage,
  DEFAULT_WHATSAPP_SETTINGS,
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
    quantity: 2,
    size: "M",
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

const DETAILED_PRODUCT_TEMPLATE =
  "{{index}}. {{name}}{{catalogue}}\n   Ref: {{productId}} | Qty: {{quantity}}\n   {{sizeLine}}{{lineTotal}}\n   {{link}}";

export function WhatsAppSettingsForm({
  initialSettings,
  siteUrl,
}: {
  initialSettings: WhatsAppSettings;
  siteUrl: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<WhatsAppSettings>({
    ...initialSettings,
    orderIntro: initialSettings.orderIntro || DEFAULT_WHATSAPP_SETTINGS.orderIntro,
    closingMessage:
      initialSettings.closingMessage || DEFAULT_WHATSAPP_SETTINGS.closingMessage,
  });
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
    <form onSubmit={saveSettings} className="mt-8 max-w-5xl space-y-5">
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

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-primary">Message style</p>
        <p className="mt-1 text-xs text-text-muted">
          Start with a clean preset, then edit every section below. The preview updates instantly.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                defaultGreeting: DEFAULT_WHATSAPP_SETTINGS.defaultGreeting,
                orderIntro: DEFAULT_WHATSAPP_SETTINGS.orderIntro,
                productTemplate: DEFAULT_WHATSAPP_SETTINGS.productTemplate,
                closingMessage: DEFAULT_WHATSAPP_SETTINGS.closingMessage,
              }))
            }
            className="btn-primary min-h-10 px-4 text-xs"
          >
            Professional concise
          </button>
          <button
            type="button"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                defaultGreeting: DEFAULT_WHATSAPP_SETTINGS.defaultGreeting,
                orderIntro: DEFAULT_WHATSAPP_SETTINGS.orderIntro,
                productTemplate: DETAILED_PRODUCT_TEMPLATE,
                closingMessage: DEFAULT_WHATSAPP_SETTINGS.closingMessage,
              }))
            }
            className="btn-secondary min-h-10 px-4 text-xs"
          >
            Detailed with links
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:items-start">
        <div className="space-y-5">
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
        <span className="mb-1 block text-sm font-medium">1. Greeting</span>
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
        <span className="mb-1 block text-sm font-medium">2. Order introduction</span>
        <input
          value={settings.orderIntro}
          onChange={(event) =>
            setSettings((current) => ({ ...current, orderIntro: event.target.value }))
          }
          maxLength={500}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          required
        />
        <span className="mt-1 block text-xs text-text-muted">
          Available fields: {"{{itemCount}}"}, {"{{total}}"}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">3. Each product line</span>
        <textarea
          value={settings.productTemplate}
          onChange={(event) =>
            setSettings((current) => ({ ...current, productTemplate: event.target.value }))
          }
          rows={6}
          maxLength={2000}
          className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
          required
        />
        <span className="mt-1 block text-xs text-text-muted">
          Available fields: {"{{index}}"}, {"{{name}}"}, {"{{price}}"}, {"{{productId}}"},{" "}
          {"{{link}}"}, {"{{catalogue}}"}, {"{{size}}"}, {"{{sizeLine}}"},{" "}
          {"{{quantity}}"}, {"{{unitPrice}}"}, {"{{lineTotal}}"}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">4. Closing message</span>
        <textarea
          value={settings.closingMessage}
          onChange={(event) =>
            setSettings((current) => ({ ...current, closingMessage: event.target.value }))
          }
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          required
        />
        <span className="mt-1 block text-xs text-text-muted">
          Available fields: {"{{itemCount}}"}, {"{{total}}"}
        </span>
      </label>
        </div>

      <div className="rounded-xl border border-[#d8e4d9] bg-[#eef6ef] p-4 text-sm text-text-muted lg:sticky lg:top-6">
        <p className="font-medium text-text">Live order-message preview</p>
        <p className="mt-1 text-xs">
          Updates instantly while you type and matches the customer&apos;s WhatsApp message.
        </p>
        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-text shadow-sm">
          {preview}
        </pre>
      </div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary min-h-11 px-6 text-sm">
        {saving ? "Applying…" : "Apply WhatsApp changes"}
      </button>
    </form>
  );
}
