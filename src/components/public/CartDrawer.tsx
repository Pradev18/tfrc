"use client";

import Image from "next/image";
import { X, Trash2, MessageCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import {
  buildCartWhatsAppUrl,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
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

  const waHref =
    items.length > 0
      ? buildCartWhatsAppUrl(
          settings,
          items.map((i) => ({
            name: i.name,
            productId: i.productId,
            regularPrice: i.price,
            currency: i.currency,
            slug: i.slug,
            imageUrl: i.imageUrl,
            environmentSlug: i.environmentSlug,
            displayPrice: i.price,
          })),
          siteUrl
        )
      : `https://wa.me/${settings.phoneNumber}`;

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
                Select multiple products, then order everything on WhatsApp in one message.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg border border-border p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-contain p-1"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-text-subtle">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-text-subtle">
                      {item.environmentName}
                    </p>
                    <p className="line-clamp-2 text-sm font-medium text-text">{item.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {formatCurrency(item.price, item.currency)}
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
            </>
          )}

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-semibold text-white transition-colors ${
              items.length > 0
                ? "bg-whatsapp hover:bg-whatsapp-hover"
                : "bg-text-subtle cursor-not-allowed opacity-60"
            }`}
            onClick={(e) => {
              if (items.length === 0) {
                e.preventDefault();
                return;
              }
              trackMetaInitiateCheckout(
                items.reduce((s, i) => s + i.price, 0),
                items[0]?.currency ?? "QAR",
                items.length
              );
            }}
          >
            <MessageCircle className="h-5 w-5" />
            {items.length > 0 ? "Order on WhatsApp" : "Add products first"}
          </a>
        </div>
      </aside>
    </>
  );
}
