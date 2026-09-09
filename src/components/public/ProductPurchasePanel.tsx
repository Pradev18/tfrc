"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AddToCartButton } from "@/components/public/AddToCartButton";
import { TrackedWhatsAppButton } from "@/components/public/TrackedWhatsAppButton";
import { PriceDisplay } from "@/components/public/PriceDisplay";
import {
  buildWhatsAppMessage,
  generateWhatsAppLinkSync,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import type { EffectivePrice } from "@/lib/pricing";
import { UiSelect } from "@/components/ui/UiSelect";
import { useCart } from "@/context/CartContext";
import { trackCustomerInquiry } from "@/lib/track-inquiry";
import { calculateLineTotal } from "@/lib/money";
import { variantOptionLabel } from "@/lib/product-variants";

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
  sizeVariants?: Array<{
    id: string;
    productId: string;
    slug: string;
    name: string;
    label: string;
    inStock: boolean;
    price: number;
    currency: string;
    imageUrl?: string;
  }>;
  initialSizeSelected?: boolean;
}

const QTY_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

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
  sizeVariants = [],
  initialSizeSelected = false,
}: ProductPurchasePanelProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [multiSizeQuantities, setMultiSizeQuantities] = useState<Record<string, number>>({});
  const [multiSizeError, setMultiSizeError] = useState("");
  const [multiSizeAdded, setMultiSizeAdded] = useState(false);
  const requiresSize = sizeVariants.length > 1;
  const [selectedSizeSlug, setSelectedSizeSlug] = useState(
    initialSizeSelected ? slug : ""
  );
  const sizeSelectionReady =
    !requiresSize || (initialSizeSelected && selectedSizeSlug === slug);

  useEffect(() => {
    setSelectedSizeSlug(initialSizeSelected ? slug : "");
  }, [initialSizeSelected, slug]);

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
      size: sizeSelectionReady ? sizeVariants.find((variant) => variant.slug === slug)?.label : undefined,
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
      sizeSelectionReady,
      sizeVariants,
    ]
  );

  const whatsappHref = generateWhatsAppLinkSync(whatsappSettings, productPayload, siteUrl);
  const whatsappMessage = buildWhatsAppMessage(whatsappSettings, productPayload, siteUrl);

  function addMultipleSizes() {
    const selected = sizeVariants.filter(
      (variant) => variant.inStock && (multiSizeQuantities[variant.id] ?? 0) > 0
    );
    if (selected.length === 0) {
      setMultiSizeAdded(false);
      setMultiSizeError("Select a quantity for at least one size.");
      return;
    }

    for (const variant of selected) {
      addItem({
        id: variant.id,
        productId: variant.productId,
        slug: variant.slug,
        name: variant.name,
        price: variant.price,
        currency: variant.currency,
        imageUrl: variant.imageUrl,
        environmentSlug,
        environmentName,
        quantity: multiSizeQuantities[variant.id],
        size: variant.label,
      });
    }

    const totalUnits = selected.reduce(
      (sum, variant) => sum + multiSizeQuantities[variant.id],
      0
    );
    const total = selected.reduce(
      (sum, variant) =>
        sum + calculateLineTotal(variant.price, multiSizeQuantities[variant.id]),
      0
    );
    trackCustomerInquiry({
      eventType: "ADD_TO_CART",
      environmentSlug,
      environmentName,
      itemCount: totalUnits,
      estimatedTotal: total,
      currency: selected[0]?.currency ?? pricing.currency,
      items: selected.map((variant) => ({
        productId: variant.productId,
        productName: variant.name,
        slug: variant.slug,
        price: variant.price,
        currency: variant.currency,
        environmentSlug,
        environmentName,
        quantity: multiSizeQuantities[variant.id],
        size: variant.label,
      })),
    });
    setMultiSizeError("");
    setMultiSizeAdded(true);
  }

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

      {requiresSize && (
        <div className="mt-4">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#6b6560]">
            Size / option
          </span>
          <UiSelect
            value={selectedSizeSlug}
            options={[
              { value: "", label: "Select an option" },
              ...sizeVariants.map((variant) => ({
                value: variant.slug,
                label: `${variantOptionLabel(variant, sizeVariants)}${
                  variant.inStock ? "" : " — unavailable"
                }`,
                disabled: !variant.inStock,
              })),
            ]}
            onValueChange={(nextSlug) => {
              setSelectedSizeSlug(nextSlug);
              if (nextSlug) {
                router.replace(
                  `/${environmentSlug}/product/${nextSlug}?sizeSelected=1`,
                  { scroll: false }
                );
              }
            }}
            ariaLabel={`Option for ${name}`}
            className="min-h-[44px] border-[#ebe8e3] bg-[#faf9f7]"
          />
          {!sizeSelectionReady && (
            <p className="mt-1.5 text-sm font-semibold text-red-600">
              Please select an option before adding this item.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2.5">
        <span className="shrink-0 text-[11px] font-medium text-[#6b6560]">Qty</span>
        <UiSelect
          value={quantity}
          options={QTY_OPTIONS}
          onValueChange={(next) => setQuantity(Number(next))}
          ariaLabel={`Quantity for ${name}`}
          className="min-h-[42px] border-[#ebe8e3] bg-[#faf9f7]"
        />
      </div>

      {requiresSize && sizeVariants.length > 1 && (
        <details className="mt-4 rounded-xl border border-[#ebe8e3] bg-[#faf9f7] p-3.5">
          <summary className="cursor-pointer text-sm font-semibold text-[#141414]">
            Order multiple sizes
          </summary>
          <p className="mt-1 text-xs leading-relaxed text-[#6b6560]">
            Choose a separate quantity for every size you need.
          </p>
          <div className="mt-3 space-y-2">
            {sizeVariants.map((variant) => (
              <div
                key={variant.id}
                className="grid grid-cols-[1fr_7rem] items-center gap-3 rounded-lg bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-[#141414]">
                    {variantOptionLabel(variant, sizeVariants)}
                  </p>
                  <p className="text-xs text-[#6b6560]">
                    {variant.inStock
                      ? `${variant.currency} ${variant.price.toFixed(2)}`
                      : "Unavailable"}
                  </p>
                </div>
                <UiSelect
                  value={multiSizeQuantities[variant.id] ?? 0}
                  options={[
                    { value: "0", label: "None" },
                    ...QTY_OPTIONS,
                  ]}
                  onValueChange={(value) => {
                    setMultiSizeQuantities((current) => ({
                      ...current,
                      [variant.id]: Number(value),
                    }));
                    setMultiSizeError("");
                    setMultiSizeAdded(false);
                  }}
                  ariaLabel={`Quantity for size ${variant.label}`}
                  disabled={!variant.inStock}
                  className="min-h-[38px] bg-white text-xs"
                />
              </div>
            ))}
          </div>
          {multiSizeError && (
            <p className="mt-2 text-sm font-semibold text-red-600">{multiSizeError}</p>
          )}
          {multiSizeAdded && (
            <p className="mt-2 text-sm font-semibold text-[#128c47]">
              Selected sizes added separately to your cart.
            </p>
          )}
          <button
            type="button"
            onClick={addMultipleSizes}
            className="mt-3 min-h-[44px] w-full rounded-full font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            Add selected sizes to cart
          </button>
        </details>
      )}

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
        {sizeSelectionReady ? (
          <>
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
              variantLabel={sizeVariants.find((variant) => variant.slug === slug)?.label}
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
                estimatedTotal: calculateLineTotal(pricing.displayPrice, quantity),
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
                    quantity,
                    size: sizeVariants.find((variant) => variant.slug === slug)?.label,
                  },
                ],
              }}
            />
          </>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-[48px] w-full rounded-full bg-[#9c9690]/25 text-sm font-semibold text-[#6b6560]"
          >
            Select a size to continue
          </button>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#6b6560]">
        No online payment. Add to cart and send your order on WhatsApp — we confirm delivery
        personally.
      </p>
    </div>
  );
}
