"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/public/AddToCartButton";
import {
  buildWhatsAppMessage,
  generateWhatsAppLinkSync,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import type { ProductListItem, ProductWithRelations } from "@/services/product.service";
import type { EffectivePrice } from "@/lib/pricing";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { getEnvVisual } from "@/lib/env-visuals";

interface ProductCardActionsProps {
  product: ProductWithRelations | ProductListItem;
  pricing: EffectivePrice;
  primaryImageUrl?: string;
  environmentSlug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
  accentColor?: string;
}

const QTY_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function ProductCardActions({
  product,
  pricing,
  primaryImageUrl,
  environmentSlug,
  environmentName,
  whatsappSettings,
  siteUrl,
  accentColor,
}: ProductCardActionsProps) {
  const [quantity, setQuantity] = useState(1);
  const v = getEnvVisual(environmentSlug);

  const productPayload = {
    name: product.name,
    productId: product.productId,
    regularPrice: pricing.regular,
    salePrice: pricing.sale,
    currency: pricing.currency,
    slug: product.slug,
    imageUrl: primaryImageUrl,
    environmentSlug,
    environmentName,
    quantity,
  };

  const whatsappHref = generateWhatsAppLinkSync(whatsappSettings, productPayload, siteUrl);
  const whatsappMessage = buildWhatsAppMessage(whatsappSettings, productPayload, siteUrl);

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <label className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-medium" style={{ color: v.muted }}>
          Qty
        </span>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          aria-label={`Quantity for ${product.name}`}
          className="min-h-[40px] w-full rounded-full border border-white/80 bg-white/85 px-3 text-sm font-medium backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
          style={{ color: v.heading }}
        >
          {QTY_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-2">
        <WhatsAppOrderGate
          href={whatsappHref}
          inquiry={{
            eventType: "PRODUCT_WHATSAPP",
            environmentSlug,
            environmentName,
            itemCount: quantity,
            estimatedTotal: pricing.displayPrice * quantity,
            currency: pricing.currency,
            whatsappMessage,
            items: [
              {
                productId: product.productId,
                productName: product.name,
                slug: product.slug,
                price: pricing.displayPrice,
                currency: pricing.currency,
                environmentSlug,
                environmentName,
              },
            ],
          }}
          className="glass-btn inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#128c47] px-2 py-2.5 text-[11px] font-semibold text-white transition-all hover:bg-[#0f7340] sm:gap-2 sm:px-4 sm:text-xs md:text-[13px]"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">WhatsApp</span>
        </WhatsAppOrderGate>
        <AddToCartButton
          dbId={product.id}
          productId={product.productId}
          slug={product.slug}
          name={product.name}
          price={pricing.displayPrice}
          currency={pricing.currency}
          imageUrl={primaryImageUrl}
          environmentSlug={environmentSlug}
          environmentName={environmentName}
          quantity={quantity}
          fullWidth
          accentColor={accentColor}
          variant="outline"
        />
      </div>
    </div>
  );
}
