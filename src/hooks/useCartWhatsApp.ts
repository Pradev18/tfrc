"use client";

import { useMemo } from "react";
import { useCart } from "@/context/CartContext";
import { resolveSiteUrl } from "@/lib/site-config";
import {
  buildCartWhatsAppMessage,
  buildCartWhatsAppCheckoutUrl,
  buildWhatsAppUrl,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import {
  cartEstimatedTotal,
  cartItemsToInquiryItems,
  primaryEnvironmentFromCart,
} from "@/lib/inquiry-helpers";
import type { TrackInquiryPayload } from "@/lib/inquiry-types";

function cartItemsToWhatsApp(items: ReturnType<typeof useCart>["items"]) {
  return items.map((i) => ({
    name: i.name,
    productId: i.productId,
    regularPrice: i.price,
    currency: i.currency,
    slug: i.slug,
    imageUrl: i.imageUrl,
    environmentSlug: i.environmentSlug,
    environmentName: i.environmentName,
    displayPrice: i.price,
    quantity: Math.max(1, i.quantity ?? 1),
    size: i.size,
  }));
}

export function useCartWhatsApp(settings: WhatsAppSettings, siteUrl = "") {
  const { items, clearCart } = useCart();
  const resolvedSiteUrl = resolveSiteUrl(siteUrl);

  const waHref = useMemo(() => {
    if (items.length === 0) {
      return buildWhatsAppUrl(settings.phoneNumber, settings.defaultGreeting);
    }
    return buildCartWhatsAppCheckoutUrl(
      settings,
      cartItemsToWhatsApp(items),
      resolvedSiteUrl
    );
  }, [items, settings, resolvedSiteUrl]);

  const checkoutInquiry = useMemo((): Omit<
    TrackInquiryPayload,
    "customerName" | "customerPhone"
  > | null => {
    if (items.length === 0) return null;
    const waItems = cartItemsToWhatsApp(items);
    return {
      eventType: "CART_CHECKOUT",
      ...primaryEnvironmentFromCart(items),
      itemCount: items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0),
      estimatedTotal: cartEstimatedTotal(items),
      currency: items[0]?.currency ?? "QAR",
      whatsappMessage: buildCartWhatsAppMessage(settings, waItems, resolvedSiteUrl),
      items: cartItemsToInquiryItems(items),
    };
  }, [items, settings, resolvedSiteUrl]);

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0),
    hasItems: items.length > 0,
    waHref,
    checkoutInquiry,
    clearCart,
  };
}

export function cartItemsForWhatsApp(items: ReturnType<typeof useCart>["items"]) {
  return cartItemsToWhatsApp(items);
}
