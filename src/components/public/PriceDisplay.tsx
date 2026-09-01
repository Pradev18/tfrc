"use client";

import { cn } from "@/lib/utils";
import { formatPriceDisplay } from "@/lib/pricing";
import type { EffectivePrice } from "@/lib/pricing";
import { DiscountBadge } from "@/components/public/DiscountBadge";

interface PriceDisplayProps {
  pricing: EffectivePrice;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceDisplay({ pricing, size = "md", className }: PriceDisplayProps) {
  const display = formatPriceDisplay(pricing);
  const sizeClasses = {
    sm: { regular: "text-xs", sale: "text-sm", was: "Was" },
    md: { regular: "text-xs", sale: "text-lg", was: "Was" },
    lg: { regular: "text-sm", sale: "text-3xl", was: "Was" },
  };
  const s = sizeClasses[size];

  if (pricing.isOnSale) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(s.sale, "font-bold tabular-nums text-[#dc2626]")}>
            {display.display}
          </span>
          {pricing.discountPercent != null && pricing.discountPercent > 0 && (
            <DiscountBadge percent={pricing.discountPercent} size={size === "lg" ? "lg" : "md"} />
          )}
        </div>
        <p className={cn(s.regular, "text-[#9c9690]")}>
          <span className="mr-1">{s.was}</span>
          <span className="line-through">{display.regular}</span>
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#16a34a]">
          You save {pricing.currency}{" "}
          {(pricing.regular - (pricing.sale ?? pricing.regular)).toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn(s.sale, "font-bold tabular-nums text-[#141414]")}>{display.display}</span>
    </div>
  );
}
