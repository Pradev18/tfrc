"use client";

import { ExternalLink } from "lucide-react";
import { buildWhatsAppCatalogProductUrl } from "@/lib/whatsapp-catalog";
import { trackCustomerInquiry } from "@/lib/track-inquiry";
import type { CartItem } from "@/context/CartContext";
import { calculateLineTotal } from "@/lib/money";
interface CartCatalogLinksProps {
  items: CartItem[];
  phoneNumber: string;
}

/** Per-item buttons to open products in WhatsApp Business catalog (Add to Cart there) */
export function CartCatalogLinks({ items, phoneNumber }: CartCatalogLinksProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#128c47]/20 bg-[#128c47]/5 p-3">
      <p className="text-xs font-semibold text-[#0f7340]">WhatsApp Business Catalog</p>
      <p className="mt-1 text-[11px] leading-snug text-text-muted">
        Tap each product to open it in your WhatsApp catalog and add to cart there. Product IDs
        match your synced Meta catalog.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => {
          const href = buildWhatsAppCatalogProductUrl(phoneNumber, item.productId);
          return (
          <li key={item.id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackCustomerInquiry({
                  eventType: "CATALOG_PRODUCT",
                  environmentSlug: item.environmentSlug,
                  environmentName: item.environmentName,
                  itemCount: item.quantity,
                  estimatedTotal: calculateLineTotal(item.price, item.quantity),
                  currency: item.currency,
                  whatsappUrl: href,
                  items: [
                    {
                      productId: item.productId,
                      productName: item.name,
                      slug: item.slug,
                      price: item.price,
                      currency: item.currency,
                      environmentSlug: item.environmentSlug,
                      environmentName: item.environmentName,
                      quantity: item.quantity,
                      size: item.size,
                    },
                  ],
                });
              }}
              className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-[#128c47]/25 bg-white px-3 py-2.5 text-xs font-medium text-[#0f7340] transition-colors hover:bg-[#128c47]/10"
            >
              <span className="line-clamp-2 text-left">
                {item.name}
                {item.size ? ` · Size ${item.size} · Qty ${item.quantity}` : ` · Qty ${item.quantity}`}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
