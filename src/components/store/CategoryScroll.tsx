"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";

export interface ShopCategoryItem {
  slug: string;
  name: string;
  productCount: number;
  imageUrl?: string | null;
}

interface CategoryScrollProps {
  categories: ShopCategoryItem[];
  environmentSlug: string;
  title?: string;
}

export function CategoryScroll({
  categories,
  environmentSlug,
  title = "Shop by category",
}: CategoryScrollProps) {
  const v = getEnvVisual(environmentSlug);

  if (categories.length === 0) return null;

  return (
    <section className="store-section py-10 md:py-14">
      <div className="container-pawmart">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: v.muted }}>
              Curated for you
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-medium md:text-3xl" style={{ color: v.heading }}>
              {title}
            </h2>
          </div>
          <a
            href="#catalog"
            className="hidden items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:inline-flex"
            style={{ color: v.ctaText, backgroundColor: v.cta }}
          >
            Browse all <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 md:grid-cols-4 md:gap-4 lg:grid-cols-4 xl:grid-cols-8">
          {categories.map((cat) => (
            <a
              key={cat.slug}
              href={`/${environmentSlug}?shop=${cat.slug}#category-${cat.slug}`}
              className="store-category-card group w-[7.5rem] shrink-0 sm:w-auto"
            >
              <div className="glass-card store-glass-category relative aspect-square overflow-hidden rounded-2xl bg-neutral-100">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    sizes="(max-width:768px) 132px, 160px"
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center font-display text-3xl font-medium opacity-25"
                    style={{ color: v.accent }}
                  >
                    {cat.name.charAt(0)}
                  </div>
                )}
                <span
                  className="absolute bottom-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-md backdrop-blur-sm"
                  style={{ backgroundColor: `${v.cta}e6` }}
                >
                  {cat.productCount}
                </span>
              </div>
              <p
                className="mt-2.5 line-clamp-2 text-center text-xs font-medium leading-snug md:text-sm"
                style={{ color: v.heading }}
              >
                {cat.name}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
