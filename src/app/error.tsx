"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f7]">
      <header className="border-b border-[#ebe8e3] bg-white px-6 py-5 md:px-10">
        <Link href="/" className="font-display text-2xl font-medium tracking-tight text-[#141414]">
          TFRC <span className="text-[#9c9690]">Vita Nova</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#9c9690]">
          Something went wrong
        </p>
        <h1 className="mt-6 font-display text-5xl font-medium text-[#141414] md:text-6xl">
          We hit a snag
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[#6b6560]">
          The page could not load. Try refreshing the page. If the problem continues, contact support.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[#141414] px-8 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-[#d4cfc8] px-8 py-3.5 text-sm font-semibold text-[#141414] transition-colors hover:border-[#141414]"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
