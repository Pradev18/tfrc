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
  /** Medium thumbnails in a single horizontal scroller (scales to many categories). */
  embedded?: boolean;
  activeSlug?: string | null;
  onSelect?: (slug: string | null) => void;
}

export function CategoryScroll({
  categories,
  environmentSlug,
  embedded = false,
  activeSlug = null,
  onSelect,
}: CategoryScrollProps) {
  const v = getEnvVisual(environmentSlug);

  if (categories.length === 0) return null;

  const handleSelect = (slug: string) => {
    if (onSelect) {
      onSelect(activeSlug === slug ? null : slug);
      return;
    }
    window.location.href = `/${environmentSlug}?shop=${slug}#category-${slug}`;
  };

  if (embedded) {
    return (
      <div className="scrollbar-hide -mx-0.5 flex gap-2.5 overflow-x-auto px-0.5 pb-0.5 pt-0.5">
        {categories.map((cat) => {
          const active = activeSlug === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleSelect(cat.slug)}
              className="group flex w-[4.75rem] shrink-0 flex-col items-center sm:w-[5.25rem]"
              aria-pressed={active}
            >
              <span
                className="relative block h-14 w-14 overflow-hidden rounded-xl bg-white sm:h-[4.25rem] sm:w-[4.25rem]"
                style={
                  active
                    ? { boxShadow: `0 0 0 2px ${v.cta}` }
                    : { boxShadow: "0 0 0 1px rgba(20,20,20,0.06)" }
                }
              >
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-400 ease-out group-hover:scale-[1.05]"
                    sizes="68px"
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
                className="mt-1.5 line-clamp-2 w-full text-center text-[10px] font-medium leading-tight sm:text-[11px]"
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
            <a
              key={cat.slug}
              href={`/${environmentSlug}?shop=${cat.slug}#category-${cat.slug}`}
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
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
