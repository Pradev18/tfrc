import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { ProductWithRelations } from "@/services/product.service";
import { mapProductPrices } from "@/lib/pricing";
import { getEnvVisual } from "@/lib/env-visuals";

interface PromoBannerProps {
  products: ProductWithRelations[];
  environmentSlug: string;
  title?: string;
}

/** Horizontal promo strip using real product images from Excel */
export function PromoBanner({
  products,
  environmentSlug,
  title = "Deals & offers",
}: PromoBannerProps) {
  const v = getEnvVisual(environmentSlug);
  const items = products.filter((p) => p.images.length > 0).slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section
      className="border-y py-8 md:py-10"
      style={{ borderColor: v.border, backgroundColor: v.surface }}
    >
      <div className="container-pawmart">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold md:text-xl" style={{ color: v.heading }}>
            {title}
          </h2>
          <Link
            href={`/${environmentSlug}/catalogue?sale=true`}
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: v.accent }}
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide md:mx-0 md:px-0">
          {items.map((product) => {
            const img = product.images.find((i) => i.isPrimary) ?? product.images[0];
            const { pricing } = mapProductPrices(product);
            return (
              <Link
                key={product.id}
                href={`/${environmentSlug}/product/${product.slug}`}
                className="group w-[8.5rem] shrink-0 md:w-[10rem]"
              >
                <div
                  className="relative aspect-square overflow-hidden rounded-xl border bg-white transition-shadow group-hover:shadow-md"
                  style={{ borderColor: v.border }}
                >
                  <Image
                    src={img.url}
                    alt={img.altText || product.name}
                    fill
                    className="bg-white object-cover"
                    sizes="160px"
                  />
                  {pricing.isOnSale && (
                    <span
                      className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ backgroundColor: v.accent }}
                    >
                      Sale
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-snug" style={{ color: v.heading }}>
                  {product.name}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: v.heading }}>
                  {pricing.displayPrice} {pricing.currency}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
