"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";
import { brandInitial, brandAvatarTone } from "@/lib/brand-avatar";
import { useT } from "@/context/LanguageContext";

/** Isolated brand chip for the store brand strip only. */
export interface StoreBrandItem {
  id: string;
  name: string;
  slug: string;
  /** Brand.logoUrl only (Excel brand_image / admin) — never a product photo. */
  imageUrl?: string | null;
  productCount?: number;
  categoryCount?: number;
}

interface BrandScrollProps {
  brands: StoreBrandItem[];
  environmentSlug: string;
  activeSlug?: string | null;
  onSelect?: (slug: string | null) => void;
  /** Warm the product feed before click so brand filtering feels instant. */
  onPrefetch?: (slug: string) => void;
  /**
   * Admin: letter cards (no logo) open choose-photo instead of filtering.
   * Storefront leaves this unset.
   */
  onMissingLogoClick?: (brand: StoreBrandItem) => void;
  /** Admin: brand id currently uploading a logo — show spinner on that card. */
  uploadingBrandId?: string | null;
  /** Admin: remove logo (× on image cards) → letter avatar again. */
  onClearLogo?: (brand: StoreBrandItem) => void;
}

const EDGE_ZONE_PX = 72;
const SCROLL_STEP_PX = 8;

/**
 * Horizontal brand cards under the category strip.
 * Kept separate from CategoryScroll / import / PDF so store brand browsing
 * cannot affect other catalogue workflows.
 */
export function BrandScroll({
  brands,
  environmentSlug,
  activeSlug = null,
  onSelect,
  onPrefetch,
  onMissingLogoClick,
  uploadingBrandId = null,
  onClearLogo,
}: BrandScrollProps) {
  const t = useT();
  const v = getEnvVisual(environmentSlug);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const edgeDirRef = useRef<-1 | 0 | 1>(0);
  /** Failed by brand id so a new logo URL can retry after upload. */
  const [failedBrandIds, setFailedBrandIds] = useState<Set<string>>(
    () => new Set()
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    // New logo URLs (blob preview or CDN) must not stay stuck on a prior onError letter.
    setFailedBrandIds((current) => {
      if (current.size === 0) return current;
      const next = new Set(current);
      for (const brand of brands) {
        if (brand.imageUrl?.trim()) next.delete(brand.id);
      }
      return next.size === current.size ? current : next;
    });
  }, [brands]);

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
  }, [updateScrollHints, brands.length]);

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
  }, [updateScrollHints, brands.length]);

  useEffect(() => {
    if (!onPrefetch || brands.length === 0) return;
    let cancelled = false;
    let index = 0;
    const warm = () => {
      if (cancelled || index >= brands.length) return;
      onPrefetch(brands[index]!.slug);
      index += 1;
      window.setTimeout(warm, 120);
    };
    const timer = window.setTimeout(warm, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [brands, onPrefetch]);

  if (brands.length === 0) return null;

  const markImageFailed = (brandId: string) => {
    setFailedBrandIds((current) => {
      if (current.has(brandId)) return current;
      const next = new Set(current);
      next.add(brandId);
      return next;
    });
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
    } else if (
      x >= rect.width - EDGE_ZONE_PX &&
      el.scrollLeft < el.scrollWidth - el.clientWidth - 2
    ) {
      edgeDirRef.current = 1;
    } else {
      edgeDirRef.current = 0;
    }
  };

  const stopEdgeScroll = () => {
    edgeDirRef.current = 0;
  };

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
    "relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 sm:h-[4.5rem] sm:w-[4.5rem]";

  function tileShadow(active: boolean) {
    return active
      ? { boxShadow: `0 0 0 2px ${v.cta}` }
      : { boxShadow: "0 0 0 1px rgba(20,20,20,0.06)" };
  }

  return (
    <div className="relative">
      {(canScrollLeft || canScrollRight) && (
        <>
          {canScrollLeft && (
            <button
              type="button"
              aria-label="Scroll brands left"
              onClick={() => scrollByAmount(-180)}
              className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/95 shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: v.heading }} />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              aria-label="Scroll brands right"
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
      )}

      <div
        ref={scrollerRef}
        className="scrollbar-hide -mx-0.5 flex gap-2.5 overflow-x-auto scroll-smooth px-0.5 pb-0.5 pt-0.5"
        onPointerMove={onScrollerPointerMove}
        onPointerLeave={stopEdgeScroll}
        role="list"
        aria-label={t("store.browseBrands")}
      >
        {brands.map((brand) => {
          const active = activeSlug === brand.slug;
          const image = normalizeCatalogueImageSrc(brand.imageUrl);
          const uploading = uploadingBrandId === brand.id;
          const showImage =
            Boolean(image) && !failedBrandIds.has(brand.id);
          const pickLogo =
            Boolean(onMissingLogoClick) && !showImage && !uploading;
          const canClear = Boolean(onClearLogo) && showImage && !uploading;

          return (
            <div key={brand.id} className="relative shrink-0" role="listitem">
              {canClear ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClearLogo?.(brand);
                  }}
                  className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-text shadow-sm hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove logo for ${brand.name}`}
                  title="Remove logo"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              ) : null}
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  if (uploading) return;
                  if (pickLogo) {
                    onMissingLogoClick?.(brand);
                    return;
                  }
                  onSelect?.(active ? null : brand.slug);
                }}
                onPointerEnter={() => onPrefetch?.(brand.slug)}
                onMouseEnter={(e) => {
                  onPrefetch?.(brand.slug);
                  ensureTileVisible(e.currentTarget);
                }}
                onFocus={(e) => {
                  onPrefetch?.(brand.slug);
                  ensureTileVisible(e.currentTarget);
                }}
                className={tileClass}
                aria-pressed={active}
                aria-busy={uploading}
                aria-label={
                  pickLogo
                    ? `Upload logo for ${brand.name}`
                    : uploading
                      ? `Uploading logo for ${brand.name}`
                      : undefined
                }
                title={
                  pickLogo
                    ? "Choose a photo for this brand"
                    : uploading
                      ? "Uploading…"
                      : undefined
                }
              >
                <span
                  className={`${imageClass} relative`}
                  style={tileShadow(active)}
                >
                  {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={image}
                      src={image}
                      alt=""
                      className="max-h-full max-w-full object-contain object-center"
                      loading="eager"
                      decoding="async"
                      onError={() => markImageFailed(brand.id)}
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center rounded-[0.65rem] text-lg font-semibold tracking-tight"
                      style={(() => {
                        const tone = brandAvatarTone(brand.name);
                        return { background: tone.bg, color: tone.fg };
                      })()}
                      aria-hidden
                    >
                      {brandInitial(brand.name)}
                    </span>
                  )}
                  {uploading ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/75">
                      <Loader2
                        className="h-6 w-6 animate-spin"
                        style={{ color: v.cta }}
                      />
                    </span>
                  ) : null}
                  {pickLogo ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white">
                      Add photo
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-1.5 line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight"
                  style={{ color: active ? v.cta : v.heading }}
                >
                  {brand.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
