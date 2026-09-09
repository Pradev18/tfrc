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
import { UiSelect } from "@/components/ui/UiSelect";
import { calculateLineTotal } from "@/lib/money";
import { variantOptionLabel } from "@/lib/product-variants";

interface ProductCardActionsProps {
  product: ProductWithRelations | ProductListItem;
  sizeVariants?: ProductListItem[];
  selectedVariantId?: string | null;
  onVariantChange?: (id: string | null) => void;
  pricing: EffectivePrice;
  primaryImageUrl?: string;
  environmentSlug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
  accentColor?: string;
}

const QTY_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function ProductCardActions({
  product,
  sizeVariants = [],
  selectedVariantId,
  onVariantChange,
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
  const requiresSize = sizeVariants.length > 1;
  const sizeSelected = !requiresSize || Boolean(selectedVariantId);

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
    size: product.variantLabel ?? undefined,
  };

  const whatsappHref = generateWhatsAppLinkSync(whatsappSettings, productPayload, siteUrl);
  const whatsappMessage = buildWhatsAppMessage(whatsappSettings, productPayload, siteUrl);

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      {requiresSize && (
        <div>
          <UiSelect
            value={selectedVariantId ?? ""}
            options={[
              { value: "", label: "Select size" },
              ...sizeVariants.map((variant) => ({
                value: variant.id,
                label: `${variantOptionLabel(variant, sizeVariants)}${
                  variant.inventory?.isInStock === false ? " — unavailable" : ""
                }`,
                disabled: variant.inventory?.isInStock === false,
              })),
            ]}
            onValueChange={(next) => onVariantChange?.(next || null)}
            ariaLabel={`Size for ${product.name}`}
          />
          {!sizeSelected && (
            <p className="mt-1 px-1 text-[11px] font-medium text-red-600">
              Select a size first
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-medium" style={{ color: v.muted }}>
          Qty
        </span>
        <UiSelect
          value={quantity}
          options={QTY_OPTIONS}
          onValueChange={(next) => setQuantity(Number(next))}
          ariaLabel={`Quantity for ${product.name}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-2">
        {sizeSelected ? (
          <>
            <WhatsAppOrderGate
              href={whatsappHref}
              inquiry={{
                eventType: "PRODUCT_WHATSAPP",
                environmentSlug,
                environmentName,
                itemCount: quantity,
                estimatedTotal: calculateLineTotal(pricing.displayPrice, quantity),
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
                    quantity,
                    size: product.variantLabel ?? undefined,
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
              variantLabel={product.variantLabel}
              fullWidth
              accentColor={accentColor}
              variant="outline"
            />
          </>
        ) : (
          <>
            <button type="button" disabled className="min-h-[44px] rounded-full bg-[#128c47]/40 text-xs font-semibold text-white">
              WhatsApp
            </button>
            <button type="button" disabled className="min-h-[44px] rounded-full border-2 border-[#9c9690]/30 text-xs font-semibold text-[#9c9690]">
              Select size
            </button>
          </>
        )}
      </div>
    </div>
  );
}
