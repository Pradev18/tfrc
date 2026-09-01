"use client";

import { AddToCartButton } from "@/components/public/AddToCartButton";
import { generateWhatsAppLinkSync, type WhatsAppSettings } from "@/lib/whatsapp";
import type { ProductWithRelations } from "@/services/product.service";
import type { EffectivePrice } from "@/lib/pricing";
import { MessageCircle } from "lucide-react";

interface ProductCardActionsProps {
  product: ProductWithRelations;
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
    },
    siteUrl
  );

  return (
    <div className="flex flex-col gap-2">
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
      />
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#ebe8e3] py-2 text-[11px] font-semibold text-[#6b6560] transition-colors hover:border-[#128c47] hover:text-[#128c47]"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </a>
    </div>
  );
}
