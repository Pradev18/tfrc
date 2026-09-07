"use client";

import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";
import { MEDIA_BLUR_DATA_URL } from "@/components/public/MediaFallback";
import {
  ALL_PRODUCTS_CATEGORY_SLUG,
  scrollToStoreCategory,
} from "@/lib/store-category-navigation";

export interface ShopCategoryItem {
  slug: string;
  name: string;
  productCount: number;
  imageUrl?: string | null;
}

interface CategoryScrollProps {
  categories: ShopCategoryItem[];
  environmentSlug: string;
  /** Medium thumbnails in a single horizontal scroller (scales to many categories). */
  embedded?: boolean;
  activeSlug?: string | null;
  onSelect?: (slug: string | null) => void;
  /** First tile that opens every product in the catalogue. */
  showAllProducts?: boolean;
  allProductsCount?: number;
}

export function CategoryScroll({
  categories,
  environmentSlug,
  embedded = false,
  activeSlug = null,
  onSelect,
  showAllProducts = false,
  allProductsCount,
}: CategoryScrollProps) {
  const v = getEnvVisual(environmentSlug);

  if (categories.length === 0 && !showAllProducts) return null;

  const handleSelect = (slug: string) => {
    if (onSelect) {
      onSelect(slug);
      return;
    }
    if (slug === ALL_PRODUCTS_CATEGORY_SLUG) return;
    scrollToStoreCategory(slug);
  };

  const tileClass =
    "group flex w-[5.25rem] shrink-0 flex-col items-center sm:w-[5.5rem]";
  const imageClass =
    "relative block h-16 w-16 overflow-hidden rounded-xl bg-white sm:h-[4.5rem] sm:w-[4.5rem]";

  function tileShadow(active: boolean) {
    return active
      ? { boxShadow: `0 0 0 2px ${v.cta}` }
      : { boxShadow: "0 0 0 1px rgba(20,20,20,0.06)" };
  }

  if (embedded) {
    return (
      <div className="scrollbar-hide -mx-0.5 flex gap-2.5 overflow-x-auto px-0.5 pb-0.5 pt-0.5">
        {showAllProducts && (
          <button
            type="button"
            onClick={() => handleSelect(ALL_PRODUCTS_CATEGORY_SLUG)}
            className={tileClass}
            aria-pressed={activeSlug === ALL_PRODUCTS_CATEGORY_SLUG}
          >
            <span className={imageClass} style={tileShadow(activeSlug === ALL_PRODUCTS_CATEGORY_SLUG)}>
              <span
                className="flex h-full w-full flex-col items-center justify-center gap-1"
                style={{ background: `linear-gradient(160deg, ${v.accent}18, ${v.surface})` }}
              >
                <LayoutGrid className="h-5 w-5" style={{ color: v.cta }} />
                {typeof allProductsCount === "number" && (
                  <span className="text-[9px] font-bold" style={{ color: v.muted }}>
                    {allProductsCount}
                  </span>
                )}
              </span>
            </span>
            <span
              className="mt-1.5 line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight"
              style={{
                color: activeSlug === ALL_PRODUCTS_CATEGORY_SLUG ? v.cta : v.heading,
              }}
            >
              All products
            </span>
          </button>
        )}

        {categories.map((cat) => {
          const active = activeSlug === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleSelect(cat.slug)}
              className={tileClass}
              aria-pressed={active}
            >
              <span className={imageClass} style={tileShadow(active)}>
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-400 ease-out group-hover:scale-[1.05]"
                    sizes="68px"
                    placeholder="blur"
                    blurDataURL={MEDIA_BLUR_DATA_URL}
                  />
                ) : (
                  <span
                    className="flex h-full items-center justify-center font-display text-lg font-medium opacity-30"
                    style={{ color: v.accent }}
                  >
                    {cat.name.charAt(0)}
                  </span>
                )}
              </span>
              <span
                className="mt-1.5 line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight sm:text-[11px]"
                style={{ color: active ? v.cta : v.heading }}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="store-section py-10 md:py-14">
      <div className="container-pawmart">
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:overflow-x-auto sm:px-0">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleSelect(cat.slug)}
              className="store-category-card group w-[5.5rem] shrink-0"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                    sizes="88px"
                    placeholder="blur"
                    blurDataURL={MEDIA_BLUR_DATA_URL}
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
                className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-snug"
                style={{ color: v.heading }}
              >
                {cat.name}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
