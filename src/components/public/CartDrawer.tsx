"use client";

import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/context/CartContext";
import { cartItemsForWhatsApp } from "@/hooks/useCartWhatsApp";
import {
  buildCartWhatsAppCheckoutUrl,
  buildCartWhatsAppMessage,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import { CartCatalogLinks } from "@/components/public/CartCatalogLinks";
import { CartContactFields } from "@/components/public/CartContactFields";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import {
  cartEstimatedTotal,
  cartItemsToInquiryItems,
  primaryEnvironmentFromCart,
} from "@/lib/inquiry-helpers";
import { resolveSiteUrl } from "@/lib/site-config";
import { trackMetaInitiateCheckout } from "@/components/analytics/MetaPixel";
import { formatCurrency } from "@/lib/utils";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  whatsappSettings?: WhatsAppSettings;
  siteUrl?: string;
}

export function CartDrawer({
  open,
  onClose,
  whatsappSettings,
  siteUrl = "",
}: CartDrawerProps) {
  const { items, removeItem, clearCart } = useCart();

  const settings: WhatsAppSettings = whatsappSettings ?? {
    phoneNumber: "97455049229",
    defaultGreeting: "Hello, I would like to order from TFRC Vita Nova",
    productTemplate: "",
  };

  const resolvedSiteUrl = resolveSiteUrl(siteUrl);
  const waItems = cartItemsForWhatsApp(items);
  const waHref =
    items.length > 0
      ? buildCartWhatsAppCheckoutUrl(settings, waItems, resolvedSiteUrl)
      : `https://wa.me/${settings.phoneNumber}`;

  const waMessage =
    items.length > 0
      ? buildCartWhatsAppMessage(settings, waItems, resolvedSiteUrl)
      : undefined;
  const env = primaryEnvironmentFromCart(items);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-surface shadow-2xl"
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Your Cart</h2>
            <p className="text-xs text-text-muted">
              {items.length === 0
                ? "No products selected yet"
                : `${items.length} product${items.length > 1 ? "s" : ""} selected`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-text-muted">Browse a catalogue and tap</p>
              <p className="mt-1 font-semibold text-primary">&quot;Add to Cart&quot;</p>
              <p className="mt-4 text-sm text-text-subtle">
                Select products, add them to WhatsApp Business Catalog, then send your order
                message with one tap.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg border border-border p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="bg-white object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-white text-[10px] text-text-subtle">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-text-subtle">
                      {item.environmentName}
                    </p>
                    <p className="line-clamp-2 font-sans text-sm font-medium text-text">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Qty: {Math.max(1, item.quantity ?? 1)}
                      {item.productId ? ` · Code: ${item.productId}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {formatCurrency(
                        item.price * Math.max(1, item.quantity ?? 1),
                        item.currency
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 self-start p-1 text-text-subtle hover:text-error"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              <div className="pt-2">
                <CartCatalogLinks items={items} phoneNumber={settings.phoneNumber} />
              </div>
            </ul>
          )}
        </div>

        <div className="border-t border-border p-5 space-y-3">
          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Estimated total</span>
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(
                    items.reduce((s, i) => s + i.price, 0),
                    items[0]?.currency ?? "QAR"
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={clearCart}
                className="w-full py-2 text-xs font-medium text-text-subtle hover:text-error"
              >
                Clear all
              </button>
              <p className="text-center text-[11px] text-text-muted">
                {items.length === 1
                  ? "Sends your order on WhatsApp with product details and a link your team can open."
                  : `Sends a clear order summary on WhatsApp with all ${items.length} products and links for your team to confirm.`}
              </p>
              <CartContactFields />
            </>
          )}

          {items.length > 0 ? (
            <WhatsAppOrderGate
              href={waHref}
              inquiry={{
                eventType: "CART_CHECKOUT",
                ...env,
                itemCount: items.length,
                estimatedTotal: cartEstimatedTotal(items),
                currency: items[0]?.currency ?? "QAR",
                whatsappMessage: waMessage,
                items: cartItemsToInquiryItems(items),
              }}
              onAfterNavigate={() => {
                trackMetaInitiateCheckout(
                  cartEstimatedTotal(items),
                  items[0]?.currency ?? "QAR",
                  items.length
                );
                clearCart();
                onClose();
              }}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-whatsapp py-3.5 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
            >
              <WhatsAppIcon className="h-5 w-5" />
              {items.length === 1
                ? "Send order on WhatsApp"
                : `Send order for ${items.length} products`}
            </WhatsAppOrderGate>
          ) : (
            <span className="flex w-full min-h-[48px] cursor-not-allowed items-center justify-center gap-2 rounded-md bg-text-subtle py-3.5 text-sm font-semibold text-white opacity-60">
              <WhatsAppIcon className="h-5 w-5" />
              Add products first
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
