"use client";

import { AddToCartButton } from "@/components/public/AddToCartButton";
import {
  buildWhatsAppMessage,
  generateWhatsAppLinkSync,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import type { ProductListItem, ProductWithRelations } from "@/services/product.service";
import type { EffectivePrice } from "@/lib/pricing";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface ProductCardActionsProps {
  product: ProductWithRelations | ProductListItem;
  pricing: EffectivePrice;
  primaryImageUrl?: string;
  environmentSlug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
  accentColor?: string;
}

export function ProductCardActions({
  product,
  pricing,
  primaryImageUrl,
  environmentSlug,
  environmentName,
  whatsappSettings,
  siteUrl,
  accentColor,
}: ProductCardActionsProps) {
  const whatsappHref = generateWhatsAppLinkSync(
    whatsappSettings,
    {
      name: product.name,
      productId: product.productId,
      regularPrice: pricing.regular,
      salePrice: pricing.sale,
      currency: pricing.currency,
      slug: product.slug,
      imageUrl: primaryImageUrl,
      environmentSlug,
      environmentName,
    },
    siteUrl
  );

  const whatsappMessage = buildWhatsAppMessage(
    whatsappSettings,
    {
      name: product.name,
      productId: product.productId,
      regularPrice: pricing.regular,
      salePrice: pricing.sale,
      currency: pricing.currency,
      slug: product.slug,
      imageUrl: primaryImageUrl,
      environmentSlug,
      environmentName,
    },
    siteUrl
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-2">
      <WhatsAppOrderGate
        href={whatsappHref}
        inquiry={{
          eventType: "PRODUCT_WHATSAPP",
          environmentSlug,
          environmentName,
          itemCount: 1,
          estimatedTotal: pricing.displayPrice,
          currency: pricing.currency,
          whatsappMessage,
          items: [
            {
              productId: product.productId,
              productName: product.name,
              slug: product.slug,
              price: pricing.displayPrice,
              currency: pricing.currency,
              environmentSlug,
              environmentName,
            },
          ],
        }}
        className="glass-btn inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#128c47] px-2 py-2.5 text-[11px] font-semibold text-white transition-all hover:bg-[#0f7340] sm:gap-2 sm:px-4 sm:text-xs md:text-[13px]"
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">WhatsApp</span>
      </WhatsAppOrderGate>
      <AddToCartButton
        dbId={product.id}
        productId={product.productId}
        slug={product.slug}
        name={product.name}
        price={pricing.displayPrice}
        currency={pricing.currency}
        imageUrl={primaryImageUrl}
        environmentSlug={environmentSlug}
        environmentName={environmentName}
        fullWidth
        accentColor={accentColor}
        variant="outline"
      />
    </div>
  );
}
