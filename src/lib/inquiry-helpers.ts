import type { CartItem } from "@/context/CartContext";
import type { InquiryItemPayload } from "@/lib/inquiry-types";

export function cartItemsToInquiryItems(items: CartItem[]): InquiryItemPayload[] {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    slug: item.slug,
    price: item.price,
    currency: item.currency,
    environmentSlug: item.environmentSlug,
    environmentName: item.environmentName,
  }));
}

export function cartEstimatedTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
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
