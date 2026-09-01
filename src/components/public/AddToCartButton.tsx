"use client";

import { Check, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { trackMetaAddToCart } from "@/components/analytics/MetaPixel";
import { cn } from "@/lib/utils";

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
  fullWidth?: boolean;
  size?: "sm" | "md";
  accentColor?: string;
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
  fullWidth,
  size = "sm",
  accentColor,
}: AddToCartButtonProps) {
  const { isInCart, toggleItem } = useCart();
  const inCart = isInCart(productId);

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
    };

    if (!inCart) {
      trackMetaAddToCart({
        contentId: productId,
        contentName: name,
        value: price,
        currency,
      });
    }

    toggleItem(item);
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
        inCart
          ? "border-2 bg-transparent"
          : "text-white hover:opacity-90"
      )}
      style={
        inCart
          ? { borderColor: accent, color: accent, backgroundColor: `${accent}12` }
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
