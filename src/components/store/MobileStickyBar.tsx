"use client";

import Link from "next/link";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";

interface MobileStickyBarProps {
  slug: string;
  waHref: string;
}

export function MobileStickyBar({ slug, waHref }: MobileStickyBarProps) {
  const v = getEnvVisual(slug);

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 p-3 md:hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${v.border}`,
        }}
      >
        <div className="flex gap-2.5">
          <Link
            href={`/${slug}/catalogue`}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold"
            style={{ backgroundColor: v.cta, color: v.ctaText }}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
            Shop
          </Link>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "#128c47" }}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
            WhatsApp
          </a>
        </div>
      </div>
      <div className="h-[4.5rem] md:hidden" aria-hidden />
    </>
  );
}
