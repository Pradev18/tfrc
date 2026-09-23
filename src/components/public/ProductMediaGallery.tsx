"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from "lucide-react";

export type ProductMediaItem = { type: "image" | "video"; url: string };

const SWIPE_THRESHOLD_PX = 40;
const ZOOM_SCALE = 2.5;

export function ProductMediaGallery({
  items,
  productName,
}: {
  items: ProductMediaItem[];
  productName: string;
}) {
  const media = items.filter((item) => item && typeof item.url === "string" && item.url);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const touchStartX = useRef<number | null>(null);

  const count = media.length;
  const current = media[Math.min(active, Math.max(0, count - 1))];

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setZoomed(false);
      setActive((index) => (index + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, go]);

  function markFailed(url: string) {
    setFailed((set) => {
      if (set.has(url)) return set;
      const next = new Set(set);
      next.add(url);
      return next;
    });
  }

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || zoomed) return;
    const end = event.changedTouches[0]?.clientX ?? start;
    if (Math.abs(end - start) < SWIPE_THRESHOLD_PX) return;
    go(end < start ? 1 : -1);
  }

  function updateOrigin(clientX: number, clientY: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  }

  function renderMedia(item: ProductMediaItem | undefined, mode: "main" | "lightbox") {
    if (!item || failed.has(item.url)) {
      return (
        <div className="flex h-full w-full items-center justify-center text-sm text-[#6b6560]">
          Product image unavailable
        </div>
      );
    }
    if (item.type === "video") {
      return (
        <video
          key={item.url}
          src={item.url}
          controls
          playsInline
          className="h-full w-full object-contain"
          aria-label={`${productName} video`}
          onError={() => markFailed(item.url)}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={item.url}
        src={item.url}
        alt={productName}
        draggable={false}
        onError={() => markFailed(item.url)}
        className={
          mode === "main"
            ? "h-full w-full select-none object-contain p-6 md:p-8"
            : "max-h-full max-w-full select-none object-contain transition-transform duration-200"
        }
        style={
          mode === "lightbox"
            ? { transform: zoomed ? `scale(${ZOOM_SCALE})` : "scale(1)", transformOrigin: origin }
            : undefined
        }
      />
    );
  }

  const arrowClass =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#141414] shadow-md transition hover:bg-white";

  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-xl border border-[#ebe8e3] bg-white"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current?.type === "image" && !failed.has(current.url) ? (
          <button
            type="button"
            onClick={() => {
              setZoomed(false);
              setLightboxOpen(true);
            }}
            className="block h-full w-full cursor-zoom-in"
            aria-label="Open image zoom"
          >
            {renderMedia(current, "main")}
          </button>
        ) : (
          renderMedia(current, "main")
        )}

        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className={`${arrowClass} left-3`} aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} className={`${arrowClass} right-3`} aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {count > 0 ? (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#6b6560] shadow-sm">
            {current?.type === "image" ? <ZoomIn className="h-3 w-3" /> : null}
            {active + 1} / {count}
          </div>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => {
                setZoomed(false);
                setActive(index);
              }}
              aria-label={item.type === "video" ? `Play video ${index + 1}` : `View image ${index + 1}`}
              aria-current={index === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white sm:h-20 sm:w-20 ${
                index === active ? "border-[#141414]" : "border-[#ebe8e3] opacity-80 hover:opacity-100"
              }`}
            >
              {item.type === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-[#faf9f7]">
                  <Play className="h-5 w-5 text-[#141414]" />
                </span>
              ) : failed.has(item.url) ? (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-[#9c9690]">
                  N/A
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  onError={() => markFailed(item.url)}
                  className="h-full w-full object-contain p-1"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen && current ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} image zoom`}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
            <span>
              {active + 1} / {count}
              {current.type === "image" ? (
                <span className="ml-3 text-white/60">{zoomed ? "Tap to zoom out" : "Tap image to zoom"}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Close zoom"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className={`relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6 ${
              current.type === "image" ? (zoomed ? "cursor-zoom-out" : "cursor-zoom-in") : ""
            }`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={(event) => {
              if (current.type !== "image") return;
              updateOrigin(event.clientX, event.clientY, event.currentTarget);
              setZoomed((z) => !z);
            }}
            onMouseMove={(event) => {
              if (zoomed) updateOrigin(event.clientX, event.clientY, event.currentTarget);
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (zoomed && touch) updateOrigin(touch.clientX, touch.clientY, event.currentTarget);
            }}
          >
            {renderMedia(current, "lightbox")}

            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    go(-1);
                  }}
                  className={`${arrowClass} left-4`}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    go(1);
                  }}
                  className={`${arrowClass} right-4`}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
