"use client";

import { Check, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { trackMetaAddToCart } from "@/components/analytics/MetaPixel";
import { trackCustomerInquiry } from "@/lib/track-inquiry";
import { cn } from "@/lib/utils";
import { calculateLineTotal } from "@/lib/money";

interface AddToCartButtonProps {
  productId: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  environmentSlug: string;
  environmentName: string;
  dbId: string;
  quantity?: number;
  variantLabel?: string | null;
  fullWidth?: boolean;
  size?: "sm" | "md";
  accentColor?: string;
  variant?: "solid" | "outline";
}

export function AddToCartButton({
  productId,
  slug,
  name,
  price,
  currency,
  imageUrl,
  environmentSlug,
  environmentName,
  dbId,
  quantity = 1,
  variantLabel,
  fullWidth,
  size = "sm",
  accentColor,
  variant = "solid",
}: AddToCartButtonProps) {
  const { isInCart, addItem, removeItem } = useCart();
  const inCart = isInCart(productId);
  const qty = Math.max(1, quantity);
  const lineTotal = calculateLineTotal(price, qty);

  function handleClick() {
    const item = {
      id: dbId,
      productId,
      slug,
      name,
      price,
      currency,
      imageUrl,
      environmentSlug,
      environmentName,
      quantity: qty,
      size: variantLabel?.trim() || undefined,
    };

    if (inCart) {
      trackCustomerInquiry({
        eventType: "REMOVE_FROM_CART",
        environmentSlug,
        environmentName,
        itemCount: 1,
        estimatedTotal: price,
        currency,
        items: [
          {
            productId,
            productName: name,
            slug,
            price,
            currency,
            environmentSlug,
            environmentName,
            quantity: qty,
            size: variantLabel?.trim() || undefined,
          },
        ],
      });
      removeItem(dbId);
      return;
    }

    trackMetaAddToCart({
      contentId: productId,
      contentName: name,
      value: lineTotal,
      currency,
    });
    trackCustomerInquiry({
      eventType: "ADD_TO_CART",
      environmentSlug,
      environmentName,
      itemCount: qty,
      estimatedTotal: lineTotal,
      currency,
      items: [
        {
          productId,
          productName: name,
          slug,
          price,
          currency,
          environmentSlug,
          environmentName,
          quantity: qty,
          size: variantLabel?.trim() || undefined,
        },
      ],
    });
    addItem(item);
  }

  const accent = accentColor ?? "var(--color-primary)";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98]",
        size === "sm" ? "px-4 py-2.5 text-[11px]" : "px-6 py-3.5 text-xs",
        fullWidth && "w-full",
        inCart || variant === "outline"
          ? "border-2 bg-transparent"
          : "text-white hover:opacity-90"
      )}
      style={
        inCart || variant === "outline"
          ? { borderColor: accent, color: accent, backgroundColor: inCart ? `${accent}12` : "transparent" }
          : { backgroundColor: accent, color: "#ffffff" }
      }
    >
      {inCart ? (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Added
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add to Cart
        </>
      )}
    </button>
  );
}
