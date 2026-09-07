"use client";

import Image from "next/image";
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
  /** Compact row under search — no section header */
  compact?: boolean;
}

export function CategoryScroll({
  categories,
  environmentSlug,
  compact = false,
}: CategoryScrollProps) {
  const v = getEnvVisual(environmentSlug);

  if (categories.length === 0) return null;

  return (
    <section className={compact ? "pt-3 md:pt-4" : "store-section py-10 md:py-14"}>
      <div className={compact ? undefined : "container-pawmart"}>
        <div
          className={
            compact
              ? "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:grid sm:grid-cols-4 sm:gap-2.5 sm:overflow-visible md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8"
              : "-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 md:grid-cols-4 md:gap-4 lg:grid-cols-4 xl:grid-cols-8"
          }
        >
          {categories.map((cat) => (
            <a
              key={cat.slug}
              href={`/${environmentSlug}?shop=${cat.slug}#category-${cat.slug}`}
              className={
                compact
                  ? "store-category-card group w-[5.25rem] shrink-0 sm:w-auto"
                  : "store-category-card group w-[7.5rem] shrink-0 sm:w-auto"
              }
            >
              <div
                className={
                  compact
                    ? "relative aspect-square overflow-hidden rounded-xl bg-transparent"
                    : "glass-card store-glass-category relative aspect-square overflow-hidden rounded-2xl bg-white"
                }
              >
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                    sizes={compact ? "(max-width:768px) 84px, 100px" : "(max-width:768px) 132px, 160px"}
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center font-display text-2xl font-medium opacity-25"
                    style={{ color: v.accent }}
                  >
                    {cat.name.charAt(0)}
                  </div>
                )}
              </div>
              <p
                className={
                  compact
                    ? "mt-1.5 line-clamp-2 text-center text-[10px] font-medium leading-snug sm:text-[11px]"
                    : "mt-2.5 line-clamp-2 text-center text-xs font-medium leading-snug md:text-sm"
                }
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
