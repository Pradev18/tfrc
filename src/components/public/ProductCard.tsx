import Link from "next/link";
import Image from "next/image";
import { DiscountBadge } from "@/components/public/DiscountBadge";
import { ProductCardActions } from "@/components/public/ProductCardActions";
import { PriceDisplay } from "@/components/public/PriceDisplay";
import { mapProductPrices, type ProductWithRelations } from "@/services/product.service";
import { getEnvVisual } from "@/lib/env-visuals";
import { cn } from "@/lib/utils";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface ProductCardProps {
  product: ProductWithRelations;
  whatsappSettings: WhatsAppSettings;
  environmentSlug: string;
  environmentName: string;
  siteUrl?: string;
  className?: string;
  variant?: "default" | "premium" | "compact";
}

export function ProductCard({
  product,
  whatsappSettings,
  environmentSlug,
  environmentName,
  siteUrl,
  className,
  variant = "default",
}: ProductCardProps) {
  const v = getEnvVisual(environmentSlug);
  const { pricing } = mapProductPrices(product);
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const inStock = product.inventory?.isInStock ?? true;
  const hasVideo = product.videos.length > 0;
  const productPath = `/${environmentSlug}/product/${product.slug}`;
  const compact = variant === "compact";

  return (
    <article
      className={cn(
        "store-product-card group flex h-full flex-col overflow-hidden rounded-2xl border bg-white",
        className
      )}
      style={{ borderColor: v.border, boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
    >
      <Link
        href={productPath}
        className="relative block overflow-hidden"
        style={{ aspectRatio: "1 / 1", backgroundColor: v.sectionAlt }}
      >
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText || product.name}
            width={400}
            height={400}
            className="h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: v.muted }}>
            No image
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {pricing.isOnSale && pricing.discountPercent != null && pricing.discountPercent > 0 && (
            <DiscountBadge percent={pricing.discountPercent} />
          )}
          {pricing.isOnSale && (!pricing.discountPercent || pricing.discountPercent <= 0) && (
            <span className="rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Sale
            </span>
          )}
          {hasVideo && (
            <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Video
            </span>
          )}
        </div>

        {!inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
            Check availability
          </div>
        )}
      </Link>

      <div className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-3.5 md:p-4")}>
        {product.brand && (
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: v.muted }}>
            {product.brand.name}
          </p>
        )}

        <Link href={productPath} className="mt-1 flex-1">
          <h3
            className="line-clamp-2 text-sm leading-snug md:text-[15px]"
            style={{ color: v.heading }}
          >
            {product.name}
          </h3>
        </Link>

        <div className="mt-2.5">
          <PriceDisplay pricing={pricing} size={compact ? "sm" : "md"} />
        </div>

        {!compact && (
          <div className="mt-3">
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
