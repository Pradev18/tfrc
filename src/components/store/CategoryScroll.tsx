"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";
import { MEDIA_BLUR_DATA_URL } from "@/components/public/MediaFallback";
import { useT } from "@/context/LanguageContext";
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

const EDGE_ZONE_PX = 72;
const SCROLL_STEP_PX = 8;

export function CategoryScroll({
  categories,
  environmentSlug,
  embedded = false,
  activeSlug = null,
  onSelect,
  showAllProducts = false,
  allProductsCount,
}: CategoryScrollProps) {
  const t = useT();
  const v = getEnvVisual(environmentSlug);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const edgeDirRef = useRef<-1 | 0 | 1>(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set()
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollHints();
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
  }, [updateScrollHints, categories.length, showAllProducts, allProductsCount]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = scrollerRef.current;
      const dir = edgeDirRef.current;
      if (el && dir !== 0) {
        el.scrollLeft += dir * SCROLL_STEP_PX;
        updateScrollHints();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [updateScrollHints]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheelNative = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
      updateScrollHints();
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [updateScrollHints, categories.length]);

  if (categories.length === 0 && !showAllProducts) return null;

  const markImageFailed = (url: string) => {
    setFailedImageUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  const handleSelect = (slug: string) => {
    if (onSelect) {
      onSelect(slug);
      return;
    }
    if (slug === ALL_PRODUCTS_CATEGORY_SLUG) return;
    scrollToStoreCategory(slug);
  };

  const scrollByAmount = (amount: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const onScrollerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x <= EDGE_ZONE_PX && el.scrollLeft > 0) {
      edgeDirRef.current = -1;
    } else if (x >= rect.width - EDGE_ZONE_PX && el.scrollLeft < el.scrollWidth - el.clientWidth - 2) {
      edgeDirRef.current = 1;
    } else {
      edgeDirRef.current = 0;
    }
  };

  const stopEdgeScroll = () => {
    edgeDirRef.current = 0;
  };

  /** When hovering a tile near the cut-off edge, bring it further into view. */
  const ensureTileVisible = (target: HTMLElement) => {
    const el = scrollerRef.current;
    if (!el) return;
    const scrollerRect = el.getBoundingClientRect();
    const tileRect = target.getBoundingClientRect();
    const pad = 28;
    if (tileRect.right > scrollerRect.right - pad) {
      el.scrollBy({
        left: tileRect.right - scrollerRect.right + pad + 40,
        behavior: "smooth",
      });
    } else if (tileRect.left < scrollerRect.left + pad) {
      el.scrollBy({
        left: tileRect.left - scrollerRect.left - pad - 40,
        behavior: "smooth",
      });
    }
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

  const scroller = (
    <div
      ref={scrollerRef}
      className={`scrollbar-hide flex gap-2.5 overflow-x-auto scroll-smooth px-0.5 pb-0.5 pt-0.5 ${
        embedded ? "-mx-0.5" : "-mx-4 px-4 sm:mx-0 sm:px-0"
      }`}
      onPointerMove={onScrollerPointerMove}
      onPointerLeave={stopEdgeScroll}
      role="list"
      aria-label={t("store.browseCategories")}
    >
      {showAllProducts && (
        <button
          type="button"
          onClick={() => handleSelect(ALL_PRODUCTS_CATEGORY_SLUG)}
          onMouseEnter={(e) => ensureTileVisible(e.currentTarget)}
          onFocus={(e) => ensureTileVisible(e.currentTarget)}
          className={tileClass}
          aria-pressed={activeSlug === ALL_PRODUCTS_CATEGORY_SLUG}
          role="listitem"
        >
          <span
            className={imageClass}
            style={tileShadow(activeSlug === ALL_PRODUCTS_CATEGORY_SLUG)}
          >
            <span
              className="flex h-full w-full flex-col items-center justify-center gap-1"
              style={{
                background: `linear-gradient(160deg, ${v.accent}18, ${v.surface})`,
              }}
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
              color:
                activeSlug === ALL_PRODUCTS_CATEGORY_SLUG ? v.cta : v.heading,
            }}
          >
            {t("store.allProducts")}
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
            onMouseEnter={(e) => ensureTileVisible(e.currentTarget)}
            onFocus={(e) => ensureTileVisible(e.currentTarget)}
            className={embedded ? tileClass : "store-category-card group w-[5.5rem] shrink-0"}
            aria-pressed={active}
            role="listitem"
          >
            <span
              className={
                embedded
                  ? imageClass
                  : "relative aspect-square overflow-hidden rounded-xl bg-white"
              }
              style={embedded ? tileShadow(active) : undefined}
            >
              {cat.imageUrl && !failedImageUrls.has(cat.imageUrl) ? (
                <Image
                  src={cat.imageUrl}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-400 ease-out group-hover:scale-[1.05]"
                  sizes="68px"
                  placeholder="blur"
                  blurDataURL={MEDIA_BLUR_DATA_URL}
                  unoptimized
                  onError={() => markImageFailed(cat.imageUrl!)}
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
              className="mt-1.5 line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight"
              style={{ color: active ? v.cta : v.heading }}
            >
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  const controls = (canScrollLeft || canScrollRight) && (
    <>
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll categories left"
          onClick={() => scrollByAmount(-180)}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/95 shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: v.heading }} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll categories right"
          onClick={() => scrollByAmount(180)}
          className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/95 shadow-sm"
        >
          <ChevronRight className="h-4 w-4" style={{ color: v.heading }} />
        </button>
      )}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="relative">
        {controls}
        {scroller}
      </div>
    );
  }

  return (
    <section className="store-section py-10 md:py-14">
      <div className="container-pawmart relative">
        {controls}
        {scroller}
      </div>
    </section>
  );
}
