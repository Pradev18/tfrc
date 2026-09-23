"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Catalogue-scoped recovery UI. Prefer this over the global "snag" page so a
 * single product failure never looks like a whole-site outage.
 */
export default function StoreProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[product-page]", error);
  }, [error]);

  const detail = [error?.message, error?.digest].filter(Boolean).join(" · ");

  return (
    <div className="container-pawmart flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#9c9690]">
        Product unavailable
      </p>
      <h1 className="mt-4 font-display text-3xl font-medium text-[#141414] md:text-4xl">
        This product page could not load
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#6b6560]">
        Try again, or go back to the catalogue and open another item.
      </p>
      {detail ? (
        <p className="mt-3 max-w-xl break-words text-[11px] text-[#9c9690]">
          {detail}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[#141414] px-7 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[#d4cfc8] px-7 py-3 text-sm font-semibold text-[#141414]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
