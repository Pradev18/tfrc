"use client";

import { cn } from "@/lib/utils";
import { formatPriceDisplay } from "@/lib/pricing";
import type { EffectivePrice } from "@/lib/pricing";
import { DiscountBadge } from "@/components/public/DiscountBadge";
import { useT } from "@/context/LanguageContext";

interface PriceDisplayProps {
  pricing: EffectivePrice;
  size?: "sm" | "md" | "lg";
  className?: string;
  compact?: boolean;
  accentColor?: string;
}

export function PriceDisplay({
  pricing,
  size = "md",
  className,
  compact = false,
  accentColor,
}: PriceDisplayProps) {
  const t = useT();
  const display = formatPriceDisplay(pricing);
  const sizeClasses = {
    sm: { regular: "text-xs", sale: "text-sm" },
    md: { regular: "text-xs", sale: "text-lg" },
    lg: { regular: "text-sm", sale: "text-3xl" },
  };
  const s = sizeClasses[size];
  const saleColor = accentColor ?? "#141414";

  if (pricing.isOnSale) {
    const saved = (pricing.regular - (pricing.sale ?? pricing.regular)).toFixed(2);
    return (
      <div className={cn(compact ? "space-y-0.5" : "space-y-1", className)}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(s.sale, "font-bold tabular-nums")}
            style={{ color: accentColor ?? "#b45309" }}
          >
            {display.display}
          </span>
          {pricing.discountPercent != null && pricing.discountPercent > 0 && (
            <DiscountBadge
              percent={pricing.discountPercent}
              size={size === "lg" ? "lg" : "sm"}
              accentColor={accentColor}
            />
          )}
        </div>
        <p className={cn(s.regular, "text-[#9c9690]")}>
          {t("product.was", { price: display.regular ?? "" })}
        </p>
        {!compact && (
          <p className="text-[10px] font-medium text-[#6b6560]">
            {t("product.saveAmount", {
              currency: pricing.currency,
              amount: saved,
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn(s.sale, "font-bold tabular-nums")} style={{ color: saleColor }}>
        {display.display}
      </span>
    </div>
  );
}
