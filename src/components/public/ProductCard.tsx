import Link from "next/link";
import Image from "next/image";
import { DiscountBadge } from "@/components/public/DiscountBadge";
import { ProductCardActions } from "@/components/public/ProductCardActions";
import { PriceDisplay } from "@/components/public/PriceDisplay";
import type { ProductListItem, ProductWithRelations } from "@/services/product.service";
import { mapProductPrices } from "@/lib/pricing";
import { getEnvVisual } from "@/lib/env-visuals";
import { cn } from "@/lib/utils";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface ProductCardProps {
  product: ProductWithRelations | ProductListItem;
  whatsappSettings: WhatsAppSettings;
  environmentSlug: string;
  environmentName: string;
  siteUrl?: string;
  className?: string;
  variant?: "default" | "premium" | "compact";
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
}: ProductCardProps) {
  const v = getEnvVisual(environmentSlug);
  const { pricing } = mapProductPrices(product);
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const inStock = product.inventory?.isInStock ?? true;
  const hasVideo = product.videos.length > 0;
  const productPath = `/${environmentSlug}/product/${product.slug}`;
  const compact = variant === "compact";
  const itemCode = product.productId || product.sku || "";
  const title = productDisplayName(product.name, product.productId);

  return (
    <article
      className={cn(
        "store-product-card store-glass-product group relative flex h-full flex-col overflow-hidden rounded-2xl",
        className
      )}
    >
      {/* Full-card hit target so image + title always open the product page */}
      <Link
        href={productPath}
        prefetch
        className="absolute inset-0 z-[1]"
        aria-label={`View ${title}`}
      />

      <div className="relative overflow-hidden bg-white" style={{ aspectRatio: "1 / 1" }}>
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText || title}
            fill
            className="bg-white object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white text-xs" style={{ color: v.muted }}>
            No image
          </div>
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

      <div
        className={cn("relative z-[2] flex flex-1 flex-col border-t", compact ? "p-3" : "p-3.5 md:p-4")}
        style={{ borderColor: `${v.border}99` }}
      >
        {product.brand && (
          <p className="pointer-events-none text-[10px] font-medium uppercase tracking-wider" style={{ color: v.muted }}>
            {product.brand.name}
          </p>
        )}

        <div className="pointer-events-none mt-1 flex-1">
          <p
            className="line-clamp-2 font-sans text-sm font-medium leading-snug md:text-[15px]"
            style={{ color: v.heading }}
          >
            {title}
          </p>
          {itemCode ? (
            <p className="mt-1 font-sans text-[11px] tabular-nums" style={{ color: v.muted }}>
              Item code: {itemCode}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-none mt-2.5">
          <PriceDisplay pricing={pricing} size={compact ? "sm" : "md"} compact accentColor={v.accent} />
        </div>

        {!compact && (
          <div className="relative z-[3] mt-3">
            <ProductCardActions
              product={product}
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
