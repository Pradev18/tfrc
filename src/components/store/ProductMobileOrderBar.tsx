"use client";

import { AddToCartButton } from "@/components/public/AddToCartButton";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import { useCartWhatsApp } from "@/hooks/useCartWhatsApp";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import type { TrackInquiryPayload } from "@/lib/inquiry-types";

interface ProductMobileOrderBarProps {
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  singleProductWaHref: string;
  singleProductInquiry: Omit<TrackInquiryPayload, "customerName" | "customerPhone">;
  product: {
    id: string;
    productId: string;
    slug: string;
    name: string;
    price: number;
    currency: string;
    imageUrl?: string;
    environmentSlug: string;
    environmentName: string;
    variantLabel?: string | null;
  };
  accentColor: string;
}

export function ProductMobileOrderBar({
  whatsappSettings,
  siteUrl,
  singleProductWaHref,
  singleProductInquiry,
  product,
  accentColor,
}: ProductMobileOrderBarProps) {
  const { hasItems, itemCount, waHref, checkoutInquiry, clearCart } = useCartWhatsApp(
    whatsappSettings,
    siteUrl
  );

  const orderHref = hasItems ? waHref : singleProductWaHref;
  const orderLabel = hasItems ? `Order cart (${itemCount})` : "WhatsApp";
  const inquiry = hasItems && checkoutInquiry
    ? { ...checkoutInquiry, eventType: "MOBILE_ORDER_BAR" as const }
    : { ...singleProductInquiry, eventType: "MOBILE_ORDER_BAR" as const };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 safe-bottom border-t border-[#ebe8e3] bg-white/95 backdrop-blur-md md:hidden"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          paddingTop: "0.75rem",
        }}
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <AddToCartButton
              dbId={product.id}
              productId={product.productId}
              slug={product.slug}
              name={product.name}
              price={product.price}
              currency={product.currency}
              imageUrl={product.imageUrl}
              environmentSlug={product.environmentSlug}
              environmentName={product.environmentName}
              variantLabel={product.variantLabel}
              fullWidth
              size="md"
              accentColor={accentColor}
            />
          </div>
          <WhatsAppOrderGate
            href={orderHref}
            inquiry={inquiry}
            onAfterNavigate={() => {
              if (hasItems) clearCart();
            }}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-[#128c47] text-sm font-semibold text-white"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {orderLabel}
          </WhatsAppOrderGate>
        </div>
      </div>
      <div className="mobile-bar-spacer md:hidden" aria-hidden />
    </>
  );
}
