import type { CartItem } from "@/context/CartContext";
import type { InquiryItemPayload } from "@/lib/inquiry-types";
import { calculateOrderTotal } from "@/lib/money";

export function cartItemsToInquiryItems(items: CartItem[]): InquiryItemPayload[] {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    slug: item.slug,
    price: item.price,
    currency: item.currency,
    environmentSlug: item.environmentSlug,
    environmentName: item.environmentName,
    quantity: Math.max(1, item.quantity),
    size: item.size,
  }));
}

export function cartEstimatedTotal(items: CartItem[]): number {
  return calculateOrderTotal(items);
}

export function primaryEnvironmentFromCart(items: CartItem[]): {
  environmentSlug?: string;
  environmentName?: string;
} {
  const first = items[0];
  if (!first) return {};
  return {
    environmentSlug: first.environmentSlug,
    environmentName: first.environmentName,
  };
}
