"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/public/AddToCartButton";
import { TrackedWhatsAppButton } from "@/components/public/TrackedWhatsAppButton";
import { PriceDisplay } from "@/components/public/PriceDisplay";
import {
  buildWhatsAppMessage,
  generateWhatsAppLinkSync,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import type { EffectivePrice } from "@/lib/pricing";

export interface ProductDetailSpec {
  label: string;
  value: string;
}

interface ProductPurchasePanelProps {
  dbId: string;
  productId: string;
  slug: string;
  name: string;
  itemCode: string;
  shortDescription?: string | null;
  specs: ProductDetailSpec[];
  pricing: EffectivePrice;
  inStock: boolean;
  imageUrl?: string;
  environmentSlug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  accentColor: string;
}

const QTY_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function ProductPurchasePanel({
  dbId,
  productId,
  slug,
  name,
  itemCode,
  shortDescription,
  specs,
  pricing,
  inStock,
  imageUrl,
  environmentSlug,
  environmentName,
  whatsappSettings,
  siteUrl,
  accentColor,
}: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);

  const productPayload = useMemo(
    () => ({
      name,
      productId,
      regularPrice: pricing.regular,
      salePrice: pricing.sale,
      currency: pricing.currency,
      slug,
      imageUrl,
      environmentSlug,
      environmentName,
      quantity,
    }),
    [
      name,
      productId,
      pricing.regular,
      pricing.sale,
      pricing.currency,
      slug,
      imageUrl,
      environmentSlug,
      environmentName,
      quantity,
    ]
  );

  const whatsappHref = generateWhatsAppLinkSync(whatsappSettings, productPayload, siteUrl);
  const whatsappMessage = buildWhatsAppMessage(whatsappSettings, productPayload, siteUrl);

  return (
    <div className="rounded-xl border border-[#ebe8e3] bg-white p-5 md:p-6">
      <PriceDisplay pricing={pricing} size="lg" />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: inStock ? "#128c47" : "#c0392b" }}
          />
          <span style={{ color: inStock ? "#128c47" : "#c0392b" }}>
            {inStock ? "In stock" : "Check availability on WhatsApp"}
          </span>
        </span>
        {itemCode ? (
          <span className="font-sans text-xs tabular-nums text-[#9c9690]">
            Item code: {itemCode}
          </span>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-2.5">
        <span className="shrink-0 text-[11px] font-medium text-[#6b6560]">Qty</span>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          aria-label={`Quantity for ${name}`}
          className="min-h-[42px] w-full rounded-full border border-[#ebe8e3] bg-[#faf9f7] px-3.5 text-sm font-medium text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
        >
          {QTY_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {shortDescription ? (
        <p className="mt-4 font-sans text-sm leading-relaxed text-[#6b6560]">
          {shortDescription}
        </p>
      ) : null}

      {specs.length > 0 ? (
        <dl className="mt-4 space-y-2 border-t border-[#ebe8e3] pt-4">
          {specs.map((spec) => (
            <div key={spec.label} className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
              <dt className="font-sans text-[#9c9690]">{spec.label}</dt>
              <dd className="font-sans font-medium text-[#141414]">{spec.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-5 flex flex-col gap-2.5">
        <AddToCartButton
          dbId={dbId}
          productId={productId}
          slug={slug}
          name={name}
          price={pricing.displayPrice}
          currency={pricing.currency}
          imageUrl={imageUrl}
          environmentSlug={environmentSlug}
          environmentName={environmentName}
          quantity={quantity}
          fullWidth
          size="md"
          accentColor={accentColor}
        />
        <TrackedWhatsAppButton
          href={whatsappHref}
          size="lg"
          fullWidth
          label="Order on WhatsApp"
          inquiry={{
            eventType: "PRODUCT_WHATSAPP",
            environmentSlug,
            environmentName,
            itemCount: quantity,
            estimatedTotal: pricing.displayPrice * quantity,
            currency: pricing.currency,
            whatsappUrl: whatsappHref,
            whatsappMessage,
            items: [
              {
                productId,
                productName: name,
                slug,
                price: pricing.displayPrice,
                currency: pricing.currency,
                environmentSlug,
                environmentName,
              },
            ],
          }}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#6b6560]">
        No online payment. Add to cart and send your order on WhatsApp — we confirm delivery
        personally.
      </p>
    </div>
  );
}
