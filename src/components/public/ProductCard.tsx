"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DiscountBadge } from "@/components/public/DiscountBadge";
import { ProductCardActions } from "@/components/public/ProductCardActions";
import { PriceDisplay } from "@/components/public/PriceDisplay";
import type { ProductListItem, ProductWithRelations } from "@/services/product.service";
import { mapProductPrices } from "@/lib/pricing";
import { getEnvVisual } from "@/lib/env-visuals";
import { cn } from "@/lib/utils";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import { MEDIA_BLUR_DATA_URL, MediaFallback } from "@/components/public/MediaFallback";
import { TfrcBrand } from "@/components/brand/TfrcBrand";
import {
  deriveProductVariantIdentity,
  formatAvailableSizes,
  productDisplayTitle,
} from "@/lib/product-variants";

interface ProductCardProps {
  product: (ProductWithRelations | ProductListItem) & {
    sizeVariants?: ProductListItem[];
  };
  whatsappSettings: WhatsAppSettings;
  environmentSlug: string;
  environmentName: string;
  siteUrl?: string;
  className?: string;
  variant?: "default" | "premium" | "compact";
  variantPreselected?: boolean;
  eagerPrefetch?: boolean;
}

function productDisplayName(name: string, productId: string) {
  const id = productId?.trim();
  if (!id) return name;
  const trimmed = name.trim();
  if (trimmed.endsWith(id)) {
    return trimmed.slice(0, -id.length).replace(/[\s\-_|]+$/u, "").trim() || trimmed;
  }
  return trimmed;
}

export function ProductCard({
  product,
  whatsappSettings,
  environmentSlug,
  environmentName,
  siteUrl,
  className,
  variant = "premium",
  variantPreselected = false,
  eagerPrefetch = false,
}: ProductCardProps) {
  const router = useRouter();
  const variants = useMemo(() => {
    const list = product.sizeVariants?.length ? product.sizeVariants : [];
    return list.length > 1 ? list : [];
  }, [product.sizeVariants]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variantPreselected && product.variantLabel ? product.id : null
  );
  const selectedProduct =
    variants.find((variant) => variant.id === selectedVariantId) ?? product;
  const v = getEnvVisual(environmentSlug);
  const { pricing } = mapProductPrices(selectedProduct);
  const primaryImage =
    selectedProduct.images.find((image) => image.isPrimary) ?? selectedProduct.images[0];
  const inStock = selectedProduct.inventory?.isInStock ?? true;
  const hasVideo = selectedProduct.videos.length > 0;
  const productPath = `/${environmentSlug}/product/${selectedProduct.slug}${
    selectedVariantId ? "?sizeSelected=1" : ""
  }`;
  const compact = variant === "compact";
  const itemCode = selectedProduct.productId || selectedProduct.sku || "";
  const selectedTitle = productDisplayTitle(
    selectedProduct.name,
    selectedProduct.productId
  );
  const baseIdentity = deriveProductVariantIdentity({
    title: product.name,
    productId: product.productId,
  });
  const title =
    variants.length > 0 && !selectedVariantId
      ? baseIdentity.baseName || selectedTitle
      : selectedTitle;
  const availableSizesLabel = formatAvailableSizes(
    variants.map((variant) => variant.variantLabel)
  );

  useEffect(() => {
    if (!eagerPrefetch) return;
    router.prefetch(productPath);
  }, [eagerPrefetch, productPath, router]);

  return (
    <article
      className={cn(
        "store-product-card store-glass-product group relative flex h-full flex-col overflow-hidden rounded-2xl",
        className
      )}
    >
      <Link
        href={productPath}
        prefetch={false}
        onMouseEnter={() => router.prefetch(productPath)}
        onPointerDown={() => router.prefetch(productPath)}
        className="absolute inset-0 z-[1] rounded-2xl"
        aria-label={`Open ${title}`}
      />
      <Link
        href={productPath}
        prefetch={false}
        onMouseEnter={() => router.prefetch(productPath)}
        onTouchStart={() => router.prefetch(productPath)}
        onPointerDown={() => router.prefetch(productPath)}
        className="relative z-[2] block"
        aria-label={`View ${title}`}
      >
        <div className="relative overflow-hidden bg-white" style={{ aspectRatio: "1 / 1" }}>
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.altText || title}
              fill
              className="bg-white object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 50vw, 25vw"
              placeholder="blur"
              blurDataURL={MEDIA_BLUR_DATA_URL}
            />
          ) : (
            <MediaFallback />
          )}

          <div className="pointer-events-none absolute left-2.5 top-2.5 z-[2] flex flex-col gap-1.5">
            {pricing.isOnSale && pricing.discountPercent != null && pricing.discountPercent > 0 && (
              <DiscountBadge percent={pricing.discountPercent} accentColor={v.accent} />
            )}
            {pricing.isOnSale && (!pricing.discountPercent || pricing.discountPercent <= 0) && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                style={{ backgroundColor: v.accent }}
              >
                Sale
              </span>
            )}
            {hasVideo && (
              <span className="rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                Video
              </span>
            )}
          </div>

          {!inStock && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-black/60 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              Check availability
            </div>
          )}
        </div>
      </Link>

      <div
        className={cn("flex flex-1 flex-col border-t", compact ? "p-3" : "p-3.5 md:p-4")}
        style={{ borderColor: `${v.border}99` }}
      >
        <Link
          href={productPath}
          prefetch={false}
          onMouseEnter={() => router.prefetch(productPath)}
          onTouchStart={() => router.prefetch(productPath)}
          className="relative z-[2] flex flex-1 flex-col"
          aria-label={`View ${title} details`}
        >
          {selectedProduct.brand ? (
            <div className="flex items-center gap-1.5">
              {/tfrc/i.test(selectedProduct.brand.name) ? (
                <TfrcBrand
                  showText
                  className="gap-1"
                  iconClassName="h-2.5"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em]"
                />
              ) : (
                <p
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: v.muted }}
                >
                  {selectedProduct.brand.name}
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-1 flex-1">
            <p
              className="line-clamp-2 font-sans text-sm font-semibold leading-snug md:text-[15px]"
              style={{ color: v.heading }}
            >
              {title}
            </p>
            {itemCode ? (
              <p className="mt-1 font-sans text-[11px] tabular-nums" style={{ color: v.muted }}>
                Item code: {itemCode}
              </p>
            ) : null}
            {availableSizesLabel ? (
              <p className="mt-1.5 text-[11px] font-semibold leading-snug" style={{ color: v.body }}>
                <span className="font-medium" style={{ color: v.muted }}>
                  Sizes available:{" "}
                </span>
                {availableSizesLabel}
              </p>
            ) : null}
          </div>

          <div className="mt-2.5">
            <PriceDisplay pricing={pricing} size={compact ? "sm" : "md"} compact accentColor={v.accent} />
          </div>
        </Link>

        {!compact && (
          <div className="relative z-[2] mt-3">
            <ProductCardActions
              product={selectedProduct}
              sizeVariants={variants}
              selectedVariantId={selectedVariantId}
              onVariantChange={setSelectedVariantId}
              pricing={pricing}
              primaryImageUrl={primaryImage?.url}
              environmentSlug={environmentSlug}
              environmentName={environmentName}
              whatsappSettings={whatsappSettings}
              siteUrl={siteUrl}
              accentColor={v.cta}
            />
          </div>
        )}
      </div>
    </article>
  );
}
